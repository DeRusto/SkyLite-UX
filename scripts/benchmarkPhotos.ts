import { consola } from "consola";

// Mock fetch
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock fetch implementation
async function mockFetch(url: string) {
  await delay(100); // Simulate network latency of 100ms per request
  if (url.includes("fail")) {
    throw new Error("Failed to fetch");
  }
  return {
    ok: true,
    json: async () => ({
      assets: [
        { id: "photo1", type: "IMAGE" },
        { id: "photo2", type: "IMAGE" },
      ],
    }),
  };
}

// Test data
const selectedAlbums = ["album1", "album2", "album3", "album4", "album5"];

async function runSequential() {
  const start = performance.now();
  const photoIds = new Set<string>();
  let albumFetchErrors = 0;

  for (const albumId of selectedAlbums) {
    try {
      const albumResponse = await mockFetch(`/api/albums/${albumId}`);
      if (albumResponse.ok) {
        // @ts-expect-error Mock response doesn't match full type but works for benchmark
        const albumData = await albumResponse.json();
        if (albumData.assets) {
          // @ts-expect-error Mock response structure
          for (const asset of albumData.assets) {
            if (asset.type === "IMAGE") {
              photoIds.add(asset.id);
            }
          }
        }
      }
      else {
        albumFetchErrors++;
      }
    }
    catch {
      albumFetchErrors++;
    }
  }

  // Use vars to avoid lint errors
  if (albumFetchErrors > 0)
    consola.warn("Errors occurred");

  const end = performance.now();
  return end - start;
}

async function runParallel() {
  const start = performance.now();
  const photoIds = new Set<string>();
  let albumFetchErrors = 0;

  const fetchAlbum = async (albumId: string) => {
    try {
      const albumResponse = await mockFetch(`/api/albums/${albumId}`);
      if (albumResponse.ok) {
        // @ts-expect-error Mock response doesn't match full type but works for benchmark
        const albumData = await albumResponse.json();
        if (albumData.assets) {
          // @ts-expect-error Mock response structure
          for (const asset of albumData.assets) {
            if (asset.type === "IMAGE") {
              photoIds.add(asset.id);
            }
          }
        }
      }
      else {
        albumFetchErrors++;
      }
    }
    catch {
      albumFetchErrors++;
    }
  };

  await Promise.all(selectedAlbums.map(fetchAlbum));

  if (albumFetchErrors > 0)
    consola.warn("Errors occurred");

  const end = performance.now();
  return end - start;
}

async function main() {
  consola.info("Running Sequential Benchmark (Albums)...");
  const sequentialTime = await runSequential();
  consola.info(`Sequential Time: ${sequentialTime.toFixed(2)}ms`);

  consola.info("Running Parallel Benchmark (Albums)...");
  const parallelTime = await runParallel();
  consola.info(`Parallel Time: ${parallelTime.toFixed(2)}ms`);

  const improvement = ((sequentialTime - parallelTime) / sequentialTime) * 100;
  consola.info(`Improvement: ${improvement.toFixed(2)}%`);
}

main().catch(console.error);
