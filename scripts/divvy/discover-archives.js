import { XMLParser } from 'fast-xml-parser';

export const DIVVY_BUCKET = 'https://divvy-tripdata.s3.amazonaws.com';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function looksLikeTripArchive(key) {
  const lower = key.toLowerCase();
  return lower.endsWith('.zip')
    && (lower.includes('trip') || lower.includes('divvy'))
    && !(lower.includes('station') && !lower.includes('trip'));
}

function periodFromKey(key) {
  const monthly = key.match(/(?:^|[^0-9])((?:19|20)\d{2})(0[1-9]|1[0-2])(?:[^0-9]|$)/);
  if (monthly) return `${monthly[1]}-${monthly[2]}`;

  const quarterly = key.match(/((?:19|20)\d{2})[_-]?q([1-4])(?:q([1-4]))?/i);
  if (quarterly) {
    return quarterly[3]
      ? `${quarterly[1]}-Q${quarterly[2]}Q${quarterly[3]}`
      : `${quarterly[1]}-Q${quarterly[2]}`;
  }

  const year = key.match(/((?:19|20)\d{2})/);
  return year ? year[1] : null;
}

export async function discoverArchives() {
  const archives = [];
  let continuationToken;

  do {
    const url = new URL(DIVVY_BUCKET);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('max-keys', '1000');
    if (continuationToken) {
      url.searchParams.set('continuation-token', continuationToken);
    }

    const response = await fetch(url, {
      headers: { 'user-agent': 'WuViz-Divvy-Importer/1.0' },
    });
    if (!response.ok) {
      throw new Error(`S3 archive listing failed: ${response.status} ${response.statusText}`);
    }

    const parsed = parser.parse(await response.text()).ListBucketResult;
    for (const object of asArray(parsed?.Contents)) {
      const key = String(object.Key ?? '');
      if (!looksLikeTripArchive(key)) continue;
      archives.push({
        key,
        url: `${DIVVY_BUCKET}/${encodeURI(key)}`,
        etag: object.ETag ? String(object.ETag).replaceAll('"', '') : null,
        size: Number(object.Size ?? 0),
        lastModified: object.LastModified ? String(object.LastModified) : null,
        period: periodFromKey(key),
      });
    }

    continuationToken = parsed?.IsTruncated === 'true'
      ? parsed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return archives.sort((a, b) => {
    const periodOrder = String(a.period ?? '').localeCompare(String(b.period ?? ''));
    return periodOrder || a.key.localeCompare(b.key);
  });
}

async function main() {
  const archives = await discoverArchives();
  console.log(JSON.stringify(archives, null, 2));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
