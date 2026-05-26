#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const KEYS_PATH = path.join(REPO_ROOT, 'extension/src/conveniences/keys.js');
const SCHEMA_PATH = path.join(REPO_ROOT, 'extension/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml');

const keysSource = fs.readFileSync(KEYS_PATH, 'utf8');
const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');

const componentSchemaMap = new Map();
const childRegex = /<child\s+name='([^']+)'\s+schema='([^']+)'/g;
for (const match of schemaSource.matchAll(childRegex))
    componentSchemaMap.set(match[1], match[2]);
componentSchemaMap.set('general', 'org.gnome.shell.extensions.blur-my-shell');

const schemaKeyMap = new Map();
const schemaRegex = /<schema[^>]*id="([^"]+)"[\s\S]*?<\/schema>/g;
for (const schemaMatch of schemaSource.matchAll(schemaRegex)) {
    const schemaId = schemaMatch[1];
    const schemaBody = schemaMatch[0];
    const keys = new Set();
    const keyRegex = /<key[^>]*name="([^"]+)"/g;
    for (const keyMatch of schemaBody.matchAll(keyRegex))
        keys.add(keyMatch[1]);
    schemaKeyMap.set(schemaId, keys);
}

const blockRegex = /component:\s*"([^"]+)"[\s\S]*?schemas:\s*\[([\s\S]*?)\]/g;
const missing = [];
for (const block of keysSource.matchAll(blockRegex)) {
    const component = block[1];
    const schemaId = componentSchemaMap.get(component);
    if (!schemaId)
        continue;

    const schemaKeys = schemaKeyMap.get(schemaId) ?? new Set();
    const blockBody = block[2];
    const nameRegex = /name:\s*"([^"]+)"/g;
    for (const keyMatch of blockBody.matchAll(nameRegex)) {
        const keyName = keyMatch[1];
        if (!schemaKeys.has(keyName))
            missing.push({ component, schemaId, keyName });
    }
}

if (missing.length > 0) {
    console.error('Missing schema keys referenced by KEYS:');
    missing.forEach(item => {
        console.error(`- component=${item.component} schema=${item.schemaId} key=${item.keyName}`);
    });
    process.exit(1);
}

console.log('Schema key check passed.');
