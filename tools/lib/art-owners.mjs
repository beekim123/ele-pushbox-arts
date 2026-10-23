// Ownership is export metadata, never an asset content or approval identity.
import fs from 'node:fs';
import path from 'node:path';

export const OWNER_VALUES = Object.freeze(['common','lab','delivery','story','hell']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (value, message) => { if (!value) throw new Error(message); };
const COMMON_UI_ITEMS = new Set(['ui.action_icon','ui.key_cmd']);

export function isComposition(asset) {
  return /^(?:theme\.|ui\.screen\.|scene\.|material\.)/.test(asset.id) || asset.id?.startsWith('ui.') && asset.kind === 'procedural';
}

export function assetOwner(asset, table) {
  const explicit = table?.owners?.[asset.id];
  need(explicit === undefined || OWNER_VALUES.includes(explicit), 'invalid owner: ' + asset.id);
  need(!table || !isComposition(asset) || explicit !== undefined, 'missing composition owner: ' + asset.id);
  const owner = explicit ?? 'common';
  need((isComposition(asset) && !COMMON_UI_ITEMS.has(asset.id)) || owner === 'common', 'single sprites and UI icons must stay common: ' + asset.id);
  return owner;
}

export function validateOwnerTable(table, assets) {
  need(object(table) && table.format === 'portitor.art.owners/1' && object(table.owners) && Object.keys(table).sort().join(',') === 'format,owners', 'invalid owner metadata format');
  for (const [id, owner] of Object.entries(table.owners)) {
    need(/^[a-z]+(?:\.[a-z0-9_]+)+$/.test(id) && OWNER_VALUES.includes(owner), 'invalid owner metadata entry: ' + id);
  }
  if (assets) {
    const known = new Map(assets.map(asset => [asset.id,asset]));
    for (const id of Object.keys(table.owners)) need(known.has(id), 'unknown owner asset ID: ' + id);
    for (const asset of assets) assetOwner(asset,table);
  }
  return table;
}

export function readOwnerTable(root, assets) {
  const file = path.join(root,'art/owners.json');
  need(fs.existsSync(file), 'owner metadata table is required');
  return validateOwnerTable(JSON.parse(fs.readFileSync(file,'utf8')),assets);
}

export function withOwners(assets, table) {
  return assets.map(asset => ({...asset,owner:assetOwner(asset,table)}));
}
