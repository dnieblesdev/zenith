import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = join(serverDistFolder, '../browser');

export function app(): express.Express {
  const server = express();
  const angularApp = new AngularNodeAppEngine();

  /**
   * Serve static files from /browser folder.
   * Importantly, maxAge is set to 1 year for assets but 0 for index.html.
   */
  server.get(
    '**',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
    })
  );

  /**
   * Handle all other requests via Angular SSR.
   */
  server.get('**', (req, res, next) => {
    angularApp
      .handle(req)
      .then((response) => {
        if (response) {
          writeResponseToNodeResponse(response, res);
        } else {
          next();
        }
      })
      .catch(next);
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

if (isMainModule(import.meta.url)) {
  run();
}
