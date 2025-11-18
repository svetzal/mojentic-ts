import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from './tool';
import { Result, Ok, Err } from '../../error';
import { ToolArgs, ToolResult, ToolDescriptor } from './tool';

/**
 * A gateway for interacting with the filesystem within a sandboxed base path.
 *
 * This class provides safe filesystem operations that are restricted to a
 * specific base directory, preventing path traversal attacks.
 */
export class FilesystemGateway {
  constructor(private basePath: string) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Constructor validates base path for sandbox
    if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) {
      throw new Error(`Base path ${basePath} is not a directory`);
    }
    this.basePath = path.resolve(basePath);
  }

  /**
   * Resolves a path relative to the base path and ensures it stays within the sandbox.
   */
  resolvePath(relativePath: string): string {
    const resolved = path.resolve(this.basePath, relativePath);
    const normalized = path.normalize(resolved);

    if (!normalized.startsWith(this.basePath)) {
      throw new Error(`Path ${relativePath} attempts to escape the sandbox`);
    }

    return normalized;
  }

  /**
   * Lists files in a directory (non-recursive).
   */
  ls(relativePath: string): string[] {
    const resolvedPath = this.resolvePath(relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    const entries = fs.readdirSync(resolvedPath);

    return entries.map((entry: string) => {
      const fullPath = path.join(resolvedPath, entry);
      return path.relative(this.basePath, fullPath);
    });
  }

  /**
   * Lists all files recursively in a directory.
   */
  listAllFiles(relativePath: string): string[] {
    const resolvedPath = this.resolvePath(relativePath);
    const files: string[] = [];

    this.collectFilesRecursively(resolvedPath, files);

    return files;
  }

  private collectFilesRecursively(dir: string, files: string[]): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.collectFilesRecursively(fullPath, files);
      } else {
        files.push(path.relative(this.basePath, fullPath));
      }
    }
  }

  /**
   * Finds files matching a glob pattern (simplified implementation).
   */
  findFilesByGlob(relativePath: string, pattern: string): string[] {
    const resolvedPath = this.resolvePath(relativePath);
    const files: string[] = [];

    // Convert glob pattern to regex for simple matching
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    // eslint-disable-next-line security/detect-non-literal-regexp -- Glob pattern safely converted to regex for file matching
    const regex = new RegExp(regexPattern);

    this.findFilesByPattern(resolvedPath, regex, files);

    return files;
  }

  private findFilesByPattern(dir: string, regex: RegExp, files: string[]): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
      const stat = fs.statSync(fullPath);
      const relativePath = path.relative(this.basePath, fullPath);

      if (stat.isDirectory()) {
        this.findFilesByPattern(fullPath, regex, files);
      } else if (regex.test(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  /**
   * Finds files containing text matching a regex pattern.
   */
  findFilesContaining(relativePath: string, pattern: string): string[] {
    const resolvedPath = this.resolvePath(relativePath);
    // eslint-disable-next-line security/detect-non-literal-regexp -- User-provided regex pattern for content search
    const regex = new RegExp(pattern);
    const files: string[] = [];

    this.findMatchingFiles(resolvedPath, regex, files);

    return files;
  }

  private findMatchingFiles(dir: string, regex: RegExp, files: string[]): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.findMatchingFiles(fullPath, regex, files);
      } else if (stat.isFile()) {
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (regex.test(content)) {
            files.push(path.relative(this.basePath, fullPath));
          }
        } catch (error) {
          // Skip files that can't be read as text
        }
      }
    }
  }

  /**
   * Finds all lines in a file matching a regex pattern.
   */
  findLinesMatching(
    relativePath: string,
    fileName: string,
    pattern: string
  ): Array<{ line_number: number; content: string }> {
    const resolvedPath = this.resolvePath(relativePath);
    const filePath = path.join(resolvedPath, fileName);
    // eslint-disable-next-line security/detect-non-literal-regexp -- User-provided regex pattern for content search
    const regex = new RegExp(pattern);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matchingLines: Array<{ line_number: number; content: string }> = [];

    lines.forEach((line: string, index: number) => {
      if (regex.test(line)) {
        matchingLines.push({
          line_number: index + 1,
          content: line,
        });
      }
    });

    return matchingLines;
  }

  /**
   * Reads the content of a file.
   */
  read(relativePath: string, fileName: string): string {
    const resolvedPath = this.resolvePath(relativePath);
    const filePath = path.join(resolvedPath, fileName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Writes content to a file.
   */
  write(relativePath: string, fileName: string, content: string): void {
    const resolvedPath = this.resolvePath(relativePath);
    const filePath = path.join(resolvedPath, fileName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * Tool for listing files in a directory (non-recursive).
 */
export class ListFilesTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'list_files',
        description:
          'List files in the specified directory (non-recursive), optionally filtered by extension. Use this when you need to see what files are available in a specific directory without including subdirectories.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The path relative to the sandbox root to list files from. For example, '.' for the root directory, 'src' for the src directory, or 'docs/images' for a nested directory.",
            },
            extension: {
              type: 'string',
              description:
                "The file extension to filter by (e.g., '.py', '.txt', '.md'). If not provided, all files will be listed. For example, using '.py' will only list Python files in the directory.",
            },
          },
          additionalProperties: false,
          required: ['path'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const relativePath = args.path as string;
      const extension = args.extension as string | undefined;

      let files = this.fs.ls(relativePath);

      if (extension) {
        files = files.filter((f) => f.endsWith(extension));
      }

      return Ok(JSON.stringify(files));
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }
}

/**
 * Tool for reading the entire content of a file.
 */
export class ReadFileTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'read_file',
        description:
          'Read the entire content of a file as a string. Use this when you need to access or analyze the complete contents of a file.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The full relative path including the filename of the file to read. For example, 'README.md' for a file in the root directory, 'src/main.py' for a file in the src directory, or 'docs/images/diagram.png' for a file in a nested directory.",
            },
          },
          additionalProperties: false,
          required: ['path'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const filePath = args.path as string;
      const { directory, fileName } = this.splitPath(filePath);
      const content = this.fs.read(directory, fileName);
      return Ok(content);
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }

  private splitPath(filePath: string): { directory: string; fileName: string } {
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    return { directory, fileName };
  }
}

/**
 * Tool for writing content to a file, completely overwriting any existing content.
 */
export class WriteFileTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'write_file',
        description:
          'Write content to a file, completely overwriting any existing content. Use this when you want to replace the entire contents of a file with new content.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The full relative path including the filename where the file should be written. For example, 'output.txt' for a file in the root directory, 'src/main.py' for a file in the src directory, or 'docs/images/diagram.png' for a file in a nested directory.",
            },
            content: {
              type: 'string',
              description:
                "The content to write to the file. This will completely replace any existing content in the file. For example, 'Hello, world!' for a simple text file, or a JSON string for a configuration file.",
            },
          },
          additionalProperties: false,
          required: ['path', 'content'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const filePath = args.path as string;
      const content = args.content as string;
      const { directory, fileName } = this.splitPath(filePath);
      this.fs.write(directory, fileName, content);
      return Ok(`Successfully wrote to ${filePath}`);
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }

  private splitPath(filePath: string): { directory: string; fileName: string } {
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    return { directory, fileName };
  }
}

/**
 * Tool for listing all files recursively in a directory.
 */
export class ListAllFilesTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'list_all_files',
        description:
          'List all files recursively in the specified directory, including files in subdirectories. Use this when you need a complete inventory of all files in a directory and its subdirectories.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The path relative to the sandbox root to list files from recursively. For example, '.' for the root directory and all subdirectories, 'src' for the src directory and all its subdirectories, or 'docs/images' for a nested directory and its subdirectories.",
            },
          },
          additionalProperties: false,
          required: ['path'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const relativePath = args.path as string;
      const files = this.fs.listAllFiles(relativePath);
      return Ok(JSON.stringify(files));
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }
}

/**
 * Tool for finding files matching a glob pattern.
 */
export class FindFilesByGlobTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'find_files_by_glob',
        description:
          "Find files matching a glob pattern in the specified directory. Use this when you need to locate files with specific patterns in their names or paths (e.g., all Python files with '*.py' or all text files in any subdirectory with '**/*.txt').",
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The path relative to the sandbox root to search in. For example, '.' for the root directory, 'src' for the src directory, or 'docs/images' for a nested directory.",
            },
            pattern: {
              type: 'string',
              description:
                "The glob pattern to match files against. Examples: '*.py' for all Python files in the specified directory, '**/*.txt' for all text files in the specified directory and any subdirectory, or '**/*test*.py' for all Python files with 'test' in their name in the specified directory and any subdirectory.",
            },
          },
          additionalProperties: false,
          required: ['path', 'pattern'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const relativePath = args.path as string;
      const pattern = args.pattern as string;
      const files = this.fs.findFilesByGlob(relativePath, pattern);
      return Ok(JSON.stringify(files));
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }
}

/**
 * Tool for finding files containing text matching a regex pattern.
 */
export class FindFilesContainingTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'find_files_containing',
        description:
          'Find files containing text matching a regex pattern in the specified directory. Use this when you need to search for specific content across multiple files, such as finding all files that contain a particular function name or text string.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The path relative to the sandbox root to search in. For example, '.' for the root directory, 'src' for the src directory, or 'docs/images' for a nested directory.",
            },
            pattern: {
              type: 'string',
              description:
                "The regex pattern to search for in files. Examples: 'function\\s+main' to find files containing a main function, 'import\\s+os' to find files importing the os module, or 'TODO|FIXME' to find files containing TODO or FIXME comments. The pattern uses JavaScript's RegExp syntax.",
            },
          },
          additionalProperties: false,
          required: ['path', 'pattern'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const relativePath = args.path as string;
      const pattern = args.pattern as string;
      const files = this.fs.findFilesContaining(relativePath, pattern);
      return Ok(JSON.stringify(files));
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }
}

/**
 * Tool for finding all lines in a file matching a regex pattern.
 */
export class FindLinesMatchingTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'find_lines_matching',
        description:
          'Find all lines in a file matching a regex pattern, returning both line numbers and content. Use this when you need to locate specific patterns within a single file and need to know exactly where they appear.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The full relative path including the filename of the file to search in. For example, 'README.md' for a file in the root directory, 'src/main.py' for a file in the src directory, or 'docs/images/diagram.png' for a file in a nested directory.",
            },
            pattern: {
              type: 'string',
              description:
                "The regex pattern to match lines against. Examples: 'def\\s+\\w+' to find all function definitions, 'class\\s+\\w+' to find all class definitions, or 'TODO|FIXME' to find all TODO or FIXME comments. The pattern uses JavaScript's RegExp syntax.",
            },
          },
          additionalProperties: false,
          required: ['path', 'pattern'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const filePath = args.path as string;
      const pattern = args.pattern as string;
      const { directory, fileName } = this.splitPath(filePath);
      const lines = this.fs.findLinesMatching(directory, fileName, pattern);
      return Ok(JSON.stringify(lines));
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }

  private splitPath(filePath: string): { directory: string; fileName: string } {
    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    return { directory, fileName };
  }
}

/**
 * Tool for creating a new directory.
 */
export class CreateDirectoryTool extends BaseTool {
  constructor(private fs: FilesystemGateway) {
    super();
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'create_directory',
        description:
          'Create a new directory at the specified path. If the directory already exists, this operation will succeed without error. Use this when you need to create a directory structure before writing files to it.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                "The relative path where the directory should be created. For example, 'new_folder' for a directory in the root, 'src/new_folder' for a directory in the src directory, or 'docs/images/new_folder' for a nested directory. Parent directories will be created automatically if they don't exist.",
            },
          },
          additionalProperties: false,
          required: ['path'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const relativePath = args.path as string;
      const resolvedPath = this.fs.resolvePath(relativePath);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by resolvePath sandbox check
      fs.mkdirSync(resolvedPath, { recursive: true });
      return Ok(`Successfully created directory '${relativePath}'`);
    } catch (error: unknown) {
      return Err(error as Error);
    }
  }
}
