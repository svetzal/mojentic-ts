/**
 * Model pull example - demonstrates pulling an Ollama model with progress tracking
 */

import { OllamaGateway } from '../src';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Model Pull Example\n');

  // Initialize the gateway
  const gateway = new OllamaGateway();

  // Specify the model to pull
  const modelName = 'qwen2.5:0.5b'; // Small model for quick testing

  console.log(`Pulling model: ${modelName}\n`);

  // Track progress state for display
  const layerProgress = new Map<string, { completed: number; total: number }>();
  let currentStatus = '';

  // Pull the model with progress callback
  const result = await gateway.pullModel(modelName, (progress) => {
    // Update current status
    if (progress.status !== currentStatus) {
      currentStatus = progress.status;
      console.log(`\n📦 ${progress.status}`);
    }

    // Track layer download progress
    if (progress.digest && progress.total && progress.completed !== undefined) {
      layerProgress.set(progress.digest, {
        completed: progress.completed,
        total: progress.total,
      });

      const percentComplete = ((progress.completed / progress.total) * 100).toFixed(1);
      const shortDigest = progress.digest.substring(0, 12);

      // Format bytes
      const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      };

      console.log(
        `  ${shortDigest}: ${formatBytes(progress.completed)} / ${formatBytes(progress.total)} (${percentComplete}%)`
      );
    }
  });

  console.log('\n');

  if (isOk(result)) {
    console.log('✅ Model pull completed successfully!');
    console.log(`\nYou can now use the model with:`);
    console.log(`  const broker = new LlmBroker('${modelName}', gateway);`);
  } else {
    console.error('❌ Error pulling model:', result.error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
