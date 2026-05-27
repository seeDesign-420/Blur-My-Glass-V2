#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const KEYS_PATH = path.join(REPO_ROOT, 'extension/src/conveniences/keys.js');
const SCHEMA_PATH = path.join(REPO_ROOT, 'extension/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml');

const keysSource = fs.readFileSync(KEYS_PATH, 'utf8');
const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');
const GENERAL_ALLOWED_SCHEMA_ONLY_KEYS = new Set(['settings-version']);

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

function getContractSource(name) {
    const exportRegex = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`);
    return keysSource.match(exportRegex)?.[1] ?? '';
}

function collectContractKeys(name) {
    const contractSource = getContractSource(name);
    const blockRegex = /component:\s*'([^']+)'[\s\S]*?schemas:\s*\[([\s\S]*?)\]/g;
    const keysBySchema = new Map();

    for (const block of contractSource.matchAll(blockRegex)) {
        const component = block[1];
        const schemaId = componentSchemaMap.get(component);
        if (!schemaId)
            continue;

        const blockBody = block[2];
        const nameRegex = /name:\s*'([^']+)'/g;
        const keys = keysBySchema.get(schemaId) ?? new Set();
        for (const keyMatch of blockBody.matchAll(nameRegex))
            keys.add(keyMatch[1]);
        keysBySchema.set(schemaId, keys);
    }

    return keysBySchema;
}

function reportMissing(contractName, contractKeysBySchema) {
    const missing = [];

    for (const [schemaId, keyNames] of contractKeysBySchema.entries()) {
        const schemaKeys = schemaKeyMap.get(schemaId) ?? new Set();
        for (const keyName of keyNames) {
            if (!schemaKeys.has(keyName))
                missing.push({ schemaId, keyName });
        }
    }

    if (missing.length > 0) {
        console.error(`Missing schema keys referenced by ${contractName}:`);
        missing.forEach(item => {
            console.error(`- schema=${item.schemaId} key=${item.keyName}`);
        });
        process.exit(1);
    }
}

const activeKeysBySchema = collectContractKeys('KEYS');
const deprecatedKeysBySchema = collectContractKeys('DEPRECATED_KEYS');

reportMissing('KEYS', activeKeysBySchema);
reportMissing('DEPRECATED_KEYS', deprecatedKeysBySchema);

const unexpected = [];
for (const [schemaId, schemaKeys] of schemaKeyMap.entries()) {
    const expectedKeys = new Set([
        ...(activeKeysBySchema.get(schemaId) ?? []),
        ...(deprecatedKeysBySchema.get(schemaId) ?? []),
    ]);

    if (schemaId === 'org.gnome.shell.extensions.blur-my-shell') {
        for (const keyName of GENERAL_ALLOWED_SCHEMA_ONLY_KEYS)
            expectedKeys.add(keyName);
    }

    for (const keyName of schemaKeys) {
        if (!expectedKeys.has(keyName))
            unexpected.push({ schemaId, keyName });
    }
}

if (unexpected.length > 0) {
    console.error('Unexpected schema keys not represented in KEYS or DEPRECATED_KEYS:');
    unexpected.forEach(item => {
        console.error(`- schema=${item.schemaId} key=${item.keyName}`);
    });
    process.exit(1);
}

console.log('Schema key contract check passed.');
