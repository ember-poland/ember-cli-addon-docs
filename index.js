/* eslint-env node */
'use strict';

const path = require('path');
const execa = require('execa');
const MergeTrees = require('broccoli-merge-trees');
const Funnel = require('broccoli-funnel');

module.exports = {
  name: 'ember-cli-addon-docs',

  options: {
    ace: {
      modes: ['handlebars']
    }
  },

  config(env, baseConfig) {
    return {
      'ember-component-css': {
        namespacing: false
      }
    };
  },

  included() {
    this._super.included.apply(this, arguments);

    let importer = findImporter(this);

    importer.import(`${this._hasEmberSource() ? 'vendor' : 'bower_components'}/ember/ember-template-compiler.js`);
    importer.import('vendor/highlightjs-styles/default.css');
  },

  setupPreprocessorRegistry(type, registry) {
    if (type === 'parent') {
      let TemplateCompiler = require('./lib/preprocessors/markdown-template-compiler');
      registry.add('template', new TemplateCompiler());
    }
  },

  treeForVendor(vendor) {
    return new MergeTrees([
      vendor,
      this._highlightJSTree(),
      this._templateCompilerTree()
    ].filter(Boolean));
  },

  treeForPublic() {
    let parentAddon = this.parent.findAddonByName(this.parent.name());
    if (!parentAddon) { return; }

    let DocsGenerator = require('./lib/broccoli/docs-generator');
    let addonSources = path.resolve(parentAddon.root, parentAddon.treePaths.addon);
    return new DocsGenerator([addonSources], {
      project: this.project,
      destDir: 'docs'
    });
  },

  createDeployPlugin(options) {
    return {
      name: options.name,

      configure(options) {
        let parsed = require('npm-package-arg')(options.project.pkg.repository || '');
        if (!parsed.hosted) {
          throw new Error('Unable to parse `repository` from package.json; can\'t deploy.');
        }

        // Travis uses HTTPS for its remotes, which is no good for pushing via a deploy key, so we can't use
        // ember-cli-deploy's default of just using the configured remote as the repo URL
        options.git = options.git || {};
        options.git.repo = options.git.repo || `git@github.com:${parsed.hosted.user}/${parsed.hosted.project}.git`;

        // TODO handle `destDir` and `keep` options based on command args or something
      },

      willUpload() {
        // TODO handle stuff like customizing where the deploy key lives
        return execa.shell(`
          chmod 600 deploy_key
          eval $(ssh-agent)
          ssh-add deploy_key
          git config --global user.name Tomster
          git config --global user.email tomster@emberjs.com
        `);
      },

      didUpload() {
        return execa('pkill', ['ssh-agent']);
      }
    };
  },

  _highlightJSTree() {
    return new Funnel(path.dirname(require.resolve('highlightjs/package.json')), {
      srcDir: 'styles',
      destDir: 'highlightjs-styles'
    });
  },

  _templateCompilerTree() {
    if (this._hasEmberSource()) {
      return new Funnel(path.dirname(require.resolve('ember-source/package.json')), {
        srcDir: 'dist',
        destDir: 'ember'
      });
    }
  },

  _hasEmberSource() {
    return 'ember-source' in this.project.pkg.devDependencies;
  }
};

function findImporter(addon) {
  if (typeof addon.import === 'function') {
    // If addon.import() is present (CLI 2.7+) use that
    return addon;
  } else {
    // Otherwise, reuse the _findHost implementation that would power addon.import()
    let current = addon;
    let app;
    do {
      app = current.app || app;
    } while (current.parent.parent && (current = current.parent));
    return app;
  }
}
