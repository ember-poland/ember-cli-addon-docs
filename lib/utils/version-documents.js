'use strict';

const Inflected = require('inflected');

module.exports = function versionDocuments(docs, projectName, projectVersion) {
  versionIds(docs, projectName, projectVersion);
  docs.push(generateProjectVersionDocument(docs, projectName, projectVersion));
};

function versionIds(docs, projectName, projectVersion) {
  for (let doc of docs) {
    doc.id = `${doc.id}-${projectVersion}`;
    doc.relationships['project-version'] = {
      data: { type: 'project-version', id: `${projectName}-${projectVersion}` }
    };

    for (let key of Object.keys(doc.relationships)) {
      let relationship = doc.relationships[key];
      if (Array.isArray(relationship)) {
        versionIds(relationship, projectName, projectVersion);
      } else if (relationship && relationship.id) {
        versionIds([relationship], projectName, projectVersion);
      }
    }
  }
}

function generateProjectVersionDocument(docs, projectName, projectVersion) {
  let relationships = {};

  for (let doc of docs) {
    let pluralType = Inflected.pluralize(doc.type);
    if (!relationships[pluralType]) { relationships[pluralType] = { data: [] }; }

    relationships[pluralType].data.push({
      id: doc.id,
      type: doc.type
    });
  }

  return {
    type: 'project-version',
    id: `${projectName}-${projectVersion}`,
    relationships,
    attributes: {
      version: projectVersion
    },
  };
}
