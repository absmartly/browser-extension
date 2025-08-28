const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/sidebar/sidebar.tsx'],
      bundle: true,
      minify: true,
      outfile: 'build/chrome-mv3-prod/sidebar.js',
      platform: 'browser',
      target: 'chrome90',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css',
        '.svg': 'text',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      external: [],
    });
    console.log('Sidebar built successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();