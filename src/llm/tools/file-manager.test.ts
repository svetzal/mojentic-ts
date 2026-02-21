/**
 * Tests for file-manager tools and FilesystemGateway
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  FilesystemGateway,
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  ListAllFilesTool,
  FindFilesByGlobTool,
  FindFilesContainingTool,
  FindLinesMatchingTool,
  CreateDirectoryTool,
} from './file-manager';

describe('FilesystemGateway', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-manager-test-'));
    gateway = new FilesystemGateway(tempDir);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create gateway with valid directory', () => {
      expect(gateway).toBeDefined();
    });

    it('should throw error if base path does not exist', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent');
      expect(() => new FilesystemGateway(nonExistentPath)).toThrow(
        `Base path ${nonExistentPath} is not a directory`
      );
    });

    it('should throw error if base path is not a directory', () => {
      const filePath = path.join(tempDir, 'file.txt');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(filePath, 'content');
      expect(() => new FilesystemGateway(filePath)).toThrow(
        `Base path ${filePath} is not a directory`
      );
    });
  });

  describe('resolvePath sandbox validation', () => {
    it('should prevent path traversal with ../', () => {
      expect(() => gateway.ls('../')).toThrow('attempts to escape the sandbox');
    });

    it('should prevent path traversal with absolute paths', () => {
      expect(() => gateway.ls('/etc')).toThrow('attempts to escape the sandbox');
    });

    it('should allow valid relative paths', () => {
      const result = gateway.ls('.');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('ls', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file3.txt'), 'content');
    });

    it('should list files in root directory', () => {
      const files = gateway.ls('.');
      expect(files).toHaveLength(3);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.md');
      expect(files).toContain('subdir');
    });

    it('should list files in subdirectory', () => {
      const files = gateway.ls('subdir');
      expect(files).toHaveLength(1);
      expect(files).toContain('subdir/file3.txt');
    });

    it('should return empty array for empty directory', () => {
      const emptyDir = path.join(tempDir, 'empty');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.mkdirSync(emptyDir);
      const files = gateway.ls('empty');
      expect(files).toHaveLength(0);
    });
  });

  describe('listAllFiles', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file2.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir', 'nested'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'nested', 'file3.txt'), 'content');
    });

    it('should list all files recursively', () => {
      const files = gateway.listAllFiles('.');
      expect(files).toHaveLength(3);
      expect(files).toContain('file1.txt');
      expect(files).toContain('subdir/file2.txt');
      expect(files).toContain('subdir/nested/file3.txt');
    });

    it('should list files in subdirectory recursively', () => {
      const files = gateway.listAllFiles('subdir');
      expect(files).toHaveLength(2);
      expect(files).toContain('subdir/file2.txt');
      expect(files).toContain('subdir/nested/file3.txt');
    });

    it('should return empty array for empty directory', () => {
      const emptyDir = path.join(tempDir, 'empty');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.mkdirSync(emptyDir);
      const files = gateway.listAllFiles('empty');
      expect(files).toHaveLength(0);
    });

    it('should handle non-existent directory', () => {
      const files = gateway.listAllFiles('nonexistent');
      expect(files).toHaveLength(0);
    });
  });

  describe('findFilesByGlob', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file3.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'test.py'), 'content');
    });

    it('should find files matching wildcard pattern', () => {
      const files = gateway.findFilesByGlob('.', '*.txt');
      expect(files).toHaveLength(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('subdir/file3.txt');
    });

    it('should find files matching specific extension', () => {
      const files = gateway.findFilesByGlob('.', '*.md');
      expect(files).toHaveLength(1);
      expect(files).toContain('file2.md');
    });

    it('should find files matching pattern with question mark', () => {
      const files = gateway.findFilesByGlob('.', 'file?.txt');
      expect(files).toHaveLength(2);
    });

    it('should return empty array when no files match', () => {
      const files = gateway.findFilesByGlob('.', '*.java');
      expect(files).toHaveLength(0);
    });

    it('should handle non-existent directory', () => {
      const files = gateway.findFilesByGlob('nonexistent', '*.txt');
      expect(files).toHaveLength(0);
    });
  });

  describe('findFilesContaining', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'hello world\nfoo bar');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'just some text');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file3.txt'), 'hello again');
    });

    it('should find files containing pattern', () => {
      const files = gateway.findFilesContaining('.', 'hello');
      expect(files).toHaveLength(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('subdir/file3.txt');
    });

    it('should find files with regex pattern', () => {
      const files = gateway.findFilesContaining('.', 'foo|hello');
      expect(files).toHaveLength(2);
    });

    it('should return empty array when no files match', () => {
      const files = gateway.findFilesContaining('.', 'nonexistent');
      expect(files).toHaveLength(0);
    });

    it('should skip binary files gracefully', () => {
      // Create a file that might fail to read as text
      const binaryPath = path.join(tempDir, 'binary.bin');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(binaryPath, Buffer.from([0xff, 0xfe, 0xfd]));
      const files = gateway.findFilesContaining('.', 'hello');
      expect(files).toHaveLength(2);
    });

    it('should handle non-existent directory', () => {
      const files = gateway.findFilesContaining('nonexistent', 'pattern');
      expect(files).toHaveLength(0);
    });
  });

  describe('findLinesMatching', () => {
    beforeEach(() => {
      const content = `line 1: hello world
line 2: foo bar
line 3: hello again
line 4: just text
line 5: HELLO uppercase`;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), content);
    });

    it('should find all lines matching pattern', () => {
      const lines = gateway.findLinesMatching('.', 'test.txt', 'hello');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({ line_number: 1, content: 'line 1: hello world' });
      expect(lines[1]).toEqual({ line_number: 3, content: 'line 3: hello again' });
    });

    it('should support case-insensitive regex', () => {
      const lines = gateway.findLinesMatching('.', 'test.txt', '[Hh][Ee][Ll][Ll][Oo]');
      expect(lines).toHaveLength(3);
    });

    it('should support regex patterns', () => {
      const lines = gateway.findLinesMatching('.', 'test.txt', 'line \\d+:');
      expect(lines).toHaveLength(5);
    });

    it('should return empty array when no lines match', () => {
      const lines = gateway.findLinesMatching('.', 'test.txt', 'nonexistent');
      expect(lines).toHaveLength(0);
    });
  });

  describe('read', () => {
    it('should read file content', () => {
      const content = 'test content';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), content);
      const result = gateway.read('.', 'test.txt');
      expect(result).toBe(content);
    });

    it('should read file from subdirectory', () => {
      const content = 'nested content';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'test.txt'), content);
      const result = gateway.read('subdir', 'test.txt');
      expect(result).toBe(content);
    });

    it('should read UTF-8 content correctly', () => {
      const content = 'Hello 世界 🌍';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'utf8.txt'), content, 'utf-8');
      const result = gateway.read('.', 'utf8.txt');
      expect(result).toBe(content);
    });
  });

  describe('write', () => {
    it('should write file content', () => {
      const content = 'test content';
      gateway.write('.', 'test.txt', content);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const result = fs.readFileSync(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(result).toBe(content);
    });

    it('should write to subdirectory', () => {
      const content = 'nested content';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      gateway.write('subdir', 'test.txt', content);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const result = fs.readFileSync(path.join(tempDir, 'subdir', 'test.txt'), 'utf-8');
      expect(result).toBe(content);
    });

    it('should overwrite existing file', () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'old content');
      gateway.write('.', 'test.txt', 'new content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const result = fs.readFileSync(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(result).toBe('new content');
    });

    it('should write UTF-8 content correctly', () => {
      const content = 'Hello 世界 🌍';
      gateway.write('.', 'utf8.txt', content);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const result = fs.readFileSync(path.join(tempDir, 'utf8.txt'), 'utf-8');
      expect(result).toBe(content);
    });
  });
});

describe('ListFilesTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: ListFilesTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-files-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new ListFilesTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('list_files');
      expect(descriptor.function.description).toContain('List files');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
    });

    it('should have optional extension parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.properties?.extension).toBeDefined();
      expect(descriptor.function.parameters.required).not.toContain('extension');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file3.txt'), 'content');
    });

    it('should list all files when no extension specified', async () => {
      const result = await tool.run({ path: '.' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const files = JSON.parse(result.value as string);
        expect(files).toHaveLength(3);
      }
    });

    it('should filter by extension', async () => {
      const result = await tool.run({ path: '.', extension: '.txt' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const files = JSON.parse(result.value as string);
        expect(files).toHaveLength(2);
        expect(files).toContain('file1.txt');
        expect(files).toContain('file3.txt');
      }
    });

    it('should return error for invalid path', async () => {
      const result = await tool.run({ path: '../' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('ReadFileTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: ReadFileTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-file-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new ReadFileTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('read_file');
      expect(descriptor.function.description).toContain('Read');
    });

    it('should have required path parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
    });
  });

  describe('run', () => {
    it('should read file content', async () => {
      const content = 'test content';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), content);
      const result = await tool.run({ path: 'test.txt' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(content);
      }
    });

    it('should read file from subdirectory', async () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      const content = 'nested content';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'test.txt'), content);
      const result = await tool.run({ path: 'subdir/test.txt' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(content);
      }
    });

    it('should return error for nonexistent file', async () => {
      const result = await tool.run({ path: 'nonexistent.txt' });
      expect(result.ok).toBe(false);
    });

    it('should return error for path traversal', async () => {
      const result = await tool.run({ path: '../test.txt' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('WriteFileTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: WriteFileTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-file-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new WriteFileTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('write_file');
      expect(descriptor.function.description).toContain('Write');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
      expect(descriptor.function.parameters.required).toContain('content');
    });
  });

  describe('run', () => {
    it('should write file content', async () => {
      const content = 'test content';
      const result = await tool.run({ path: 'test.txt', content });
      expect(result.ok).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const fileContent = fs.readFileSync(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should write to subdirectory', async () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      const content = 'nested content';
      const result = await tool.run({ path: 'subdir/test.txt', content });
      expect(result.ok).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const fileContent = fs.readFileSync(path.join(tempDir, 'subdir', 'test.txt'), 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should overwrite existing file', async () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'old content');
      const result = await tool.run({ path: 'test.txt', content: 'new content' });
      expect(result.ok).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification reading controlled path
      const fileContent = fs.readFileSync(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(fileContent).toBe('new content');
    });

    it('should return success message', async () => {
      const result = await tool.run({ path: 'test.txt', content: 'content' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Successfully wrote');
      }
    });

    it('should return error for path traversal', async () => {
      const result = await tool.run({ path: '../test.txt', content: 'content' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('ListAllFilesTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: ListAllFilesTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-all-files-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new ListAllFilesTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('list_all_files');
      expect(descriptor.function.description).toContain('recursively');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file2.txt'), 'content');
    });

    it('should list all files recursively', async () => {
      const result = await tool.run({ path: '.' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const files = JSON.parse(result.value as string);
        expect(files).toHaveLength(2);
        expect(files).toContain('file1.txt');
        expect(files).toContain('subdir/file2.txt');
      }
    });

    it('should return error for invalid path', async () => {
      const result = await tool.run({ path: '../' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('FindFilesByGlobTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: FindFilesByGlobTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-glob-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new FindFilesByGlobTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('find_files_by_glob');
      expect(descriptor.function.description).toContain('glob pattern');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
      expect(descriptor.function.parameters.required).toContain('pattern');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file3.txt'), 'content');
    });

    it('should find files by pattern', async () => {
      const result = await tool.run({ path: '.', pattern: '*.txt' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const files = JSON.parse(result.value as string);
        expect(files).toHaveLength(2);
      }
    });

    it('should return error for invalid path', async () => {
      const result = await tool.run({ path: '../', pattern: '*.txt' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('FindFilesContainingTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: FindFilesContainingTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-containing-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new FindFilesContainingTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('find_files_containing');
      expect(descriptor.function.description).toContain('containing');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
      expect(descriptor.function.parameters.required).toContain('pattern');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'hello world');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled paths
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'goodbye world');
    });

    it('should find files containing pattern', async () => {
      const result = await tool.run({ path: '.', pattern: 'hello' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const files = JSON.parse(result.value as string);
        expect(files).toHaveLength(1);
        expect(files).toContain('file1.txt');
      }
    });

    it('should return error for invalid path', async () => {
      const result = await tool.run({ path: '../', pattern: 'hello' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('FindLinesMatchingTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: FindLinesMatchingTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-lines-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new FindLinesMatchingTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('find_lines_matching');
      expect(descriptor.function.description).toContain('lines');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
      expect(descriptor.function.parameters.required).toContain('pattern');
    });
  });

  describe('run', () => {
    beforeEach(() => {
      const content = `line 1: hello world
line 2: foo bar
line 3: hello again`;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.writeFileSync(path.join(tempDir, 'test.txt'), content);
    });

    it('should find lines matching pattern', async () => {
      const result = await tool.run({ path: 'test.txt', pattern: 'hello' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const lines = JSON.parse(result.value as string);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toEqual({ line_number: 1, content: 'line 1: hello world' });
        expect(lines[1]).toEqual({ line_number: 3, content: 'line 3: hello again' });
      }
    });

    it('should return error for invalid path', async () => {
      const result = await tool.run({ path: '../test.txt', pattern: 'hello' });
      expect(result.ok).toBe(false);
    });

    it('should return error for nonexistent file', async () => {
      const result = await tool.run({ path: 'nonexistent.txt', pattern: 'hello' });
      expect(result.ok).toBe(false);
    });
  });
});

describe('CreateDirectoryTool', () => {
  let tempDir: string;
  let gateway: FilesystemGateway;
  let tool: CreateDirectoryTool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-dir-test-'));
    gateway = new FilesystemGateway(tempDir);
    tool = new CreateDirectoryTool(gateway);
  });

  afterEach(() => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test cleanup using controlled tempDir path
    if (fs.existsSync(tempDir)) {

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('create_directory');
      expect(descriptor.function.description).toContain('directory');
    });

    it('should have required path parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('path');
    });
  });

  describe('run', () => {
    it('should create directory', async () => {
      const result = await tool.run({ path: 'newdir' });
      expect(result.ok).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification using controlled path
      expect(fs.existsSync(path.join(tempDir, 'newdir'))).toBe(true);
    });

    it('should create nested directories', async () => {
      const result = await tool.run({ path: 'parent/child/grandchild' });
      expect(result.ok).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test verification using controlled path
      expect(fs.existsSync(path.join(tempDir, 'parent', 'child', 'grandchild'))).toBe(true);
    });

    it('should succeed if directory already exists', async () => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled path
      fs.mkdirSync(path.join(tempDir, 'existing'));
      const result = await tool.run({ path: 'existing' });
      expect(result.ok).toBe(true);
    });

    it('should return success message', async () => {
      const result = await tool.run({ path: 'newdir' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Successfully created');
      }
    });

    it('should return error for path traversal', async () => {
      const result = await tool.run({ path: '../outside' });
      expect(result.ok).toBe(false);
    });
  });
});
