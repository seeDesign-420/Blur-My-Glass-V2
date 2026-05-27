#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const KEYS_PATH = path.join(REPO_ROOT, 'extension/src/conveniences/keys.js');
const SCHEMA_PATH = path.join(REPO_ROOT, 'extension/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml');

const keysSource = fs.readFileSync(KEYS_PATH, 'utf8');
const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');
const GENERAL_ALLOWED_SCHEMA_ONLY_KEYS = new Set(['settings-version']);
const MATERIAL_KEYS = new Set([
    'sigma',
    'brightness',
    'vibrancy',
    'corner-radius',
    'refraction-strength',
    'refraction-radius',
    'refraction-inner-radius',
    'corner-when-maximized',
]);
const MATERIAL_KEY_COVERAGE = new Map([
    ['overview', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
    ])],
    ['overlays', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
        ['corner-radius', 'binding'],
        ['refraction-strength', 'binding'],
        ['refraction-radius', 'binding'],
        ['refraction-inner-radius', 'binding'],
    ])],
    ['appfolder', new Map([
        ['sigma', 'manual'],
        ['brightness', 'manual'],
        ['vibrancy', 'manual'],
    ])],
    ['panel', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
        ['corner-radius', 'binding'],
    ])],
    ['dhruva', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
        ['corner-radius', 'binding'],
        ['refraction-strength', 'binding'],
        ['refraction-radius', 'binding'],
        ['refraction-inner-radius', 'binding'],
    ])],
    ['applications', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
        ['refraction-strength', 'binding'],
        ['corner-radius', 'binding + manual override'],
        ['refraction-radius', 'binding + manual override'],
        ['refraction-inner-radius', 'binding + manual override'],
        ['corner-when-maximized', 'manual'],
    ])],
    ['lockscreen', new Map([
        ['sigma', 'binding'],
        ['brightness', 'binding'],
        ['vibrancy', 'binding'],
    ])],
]);

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
    const keysByComponent = new Map();

    for (const block of contractSource.matchAll(blockRegex)) {
        const component = block[1];
        const schemaId = componentSchemaMap.get(component);
        if (!schemaId)
            continue;

        const blockBody = block[2];
        const nameRegex = /name:\s*'([^']+)'/g;
        const schemaKeys = keysBySchema.get(schemaId) ?? new Set();
        const componentKeys = keysByComponent.get(component) ?? new Set();
        for (const keyMatch of blockBody.matchAll(nameRegex)) {
            const keyName = keyMatch[1];
            schemaKeys.add(keyName);
            componentKeys.add(keyName);
        }
        keysBySchema.set(schemaId, schemaKeys);
        keysByComponent.set(component, componentKeys);
    }

    return { keysBySchema, keysByComponent };
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

const activeContracts = collectContractKeys('KEYS');
const deprecatedContracts = collectContractKeys('DEPRECATED_KEYS');
const activeKeysBySchema = activeContracts.keysBySchema;
const deprecatedKeysBySchema = deprecatedContracts.keysBySchema;

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

const uncoveredMaterialKeys = [];
for (const [component, keyNames] of activeContracts.keysByComponent.entries()) {
    const coverage = MATERIAL_KEY_COVERAGE.get(component) ?? new Map();
    for (const keyName of keyNames) {
        if (!MATERIAL_KEYS.has(keyName))
            continue;
        if (!coverage.has(keyName))
            uncoveredMaterialKeys.push({ component, keyName });
    }
}

if (uncoveredMaterialKeys.length > 0) {
    console.error('Active KEYS material entries missing coverage classification:');
    uncoveredMaterialKeys.forEach(item => {
        console.error(`- component=${item.component} key=${item.keyName}`);
    });
    process.exit(1);
}

const staleCoverageEntries = [];
for (const [component, coverage] of MATERIAL_KEY_COVERAGE.entries()) {
    const activeKeys = activeContracts.keysByComponent.get(component) ?? new Set();
    for (const keyName of coverage.keys()) {
        if (!activeKeys.has(keyName))
            staleCoverageEntries.push({ component, keyName });
    }
}

if (staleCoverageEntries.length > 0) {
    console.error('Material coverage contains entries not present in active KEYS:');
    staleCoverageEntries.forEach(item => {
        console.error(`- component=${item.component} key=${item.keyName}`);
    });
    process.exit(1);
}

console.log('Schema key contract check passed.');
