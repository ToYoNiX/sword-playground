import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // The engine and schema are linked from the sibling sword repo.
    fs: { allow: ['.', fileURLToPath(new URL('../sword', import.meta.url))] },
  },
  test: { environment: 'node' },
});
