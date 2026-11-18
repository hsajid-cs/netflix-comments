import assert from 'node:assert/strict'
import { test } from 'node:test'
import { METADATA_SOURCE, mergePlaybackMetadata, parsePlaybackMetadata, playbackMetadataFromCache, playbackMetadataFromPlayer, readPlaybackMetadata } from '../src/content/detector/playback-metadata.ts'
import { resolveEpisodeMetadata, resolveSeriesId, resolveTitleName } from '../src/content/detector/resolve-title-name.ts'

const unknownEpisode = { episodeName: null, seasonNumber: null, episodeNumber: null }

test('parent series comes from the current episode cache independently of the watch URL', () => {
  const cache = { videos: {
    '201': { series: { $type: 'ref', value: ['videos', '100'] } },
    '202': { series: { value: ['videos', '100'] } },
    '100': { title: { value: 'A Series' } },
  } }
  assert.deepEqual(playbackMetadataFromCache(cache, '201'), { episodeId: '201', seriesId: '100', titleName: 'A Series', ...unknownEpisode })
  assert.equal(playbackMetadataFromCache(cache, '202')?.seriesId, '100')
  assert.equal(playbackMetadataFromCache(cache, '999'), null)
})

test('cache metadata accepts explicit series IDs and rejects unrelated or malformed relationships', () => {
  assert.equal(playbackMetadataFromCache({ videos: { '201': { summary: { value: { seriesId: 100 } } } } }, '201')?.seriesId, '100')
  for (const series of [null, 'not-an-id', { value: ['seasons', '100'] }, { value: ['videos', '201'] }]) {
    assert.equal(playbackMetadataFromCache({ videos: { '201': { series } } }, '201'), null)
  }
  assert.equal(playbackMetadataFromCache(null, '201'), null)
})

test('page messages require the current episode and a numeric, separate series ID', () => {
  const valid = { source: METADATA_SOURCE, episodeId: '201', seriesId: '100', titleName: ' A Series ' }
  assert.deepEqual(parsePlaybackMetadata(valid, '201'), { episodeId: '201', seriesId: '100', titleName: 'A Series', ...unknownEpisode })
  assert.equal(parsePlaybackMetadata(valid, '202'), null)
  assert.equal(parsePlaybackMetadata({ ...valid, source: 'another-message' }, '201'), null)
  assert.equal(parsePlaybackMetadata({ ...valid, seriesId: '201' }, '201'), null)
  assert.equal(parsePlaybackMetadata({ ...valid, seriesId: '100/anything' }, '201'), null)
  assert.equal(parsePlaybackMetadata(null, '201'), null)
})

function metadataDoc(canonical: string | null, scripts: unknown[] = []): Document {
  return {
    querySelector: (selector: string) => selector.startsWith('link') && canonical ? { getAttribute: () => canonical } : null,
    querySelectorAll: () => scripts.map(value => ({ textContent: typeof value === 'string' ? value : JSON.stringify(value) })),
  } as unknown as Document
}

test('structured episode data resolves the series even when canonical metadata is a watch URL', () => {
  const data = { '@graph': [{ '@type': 'TVEpisode', url: 'https://www.netflix.com/watch/201', partOfSeries: { '@id': 'https://www.netflix.com/title/100' } }] }
  assert.equal(resolveSeriesId(metadataDoc('https://www.netflix.com/watch/201', ['invalid json', data]), '201'), '100')
  assert.equal(resolveSeriesId(metadataDoc(null, [data]), '202'), null)
  assert.equal(resolveSeriesId(metadataDoc('https://www.netflix.com/title/201'), '201'), null)
  assert.equal(resolveSeriesId(metadataDoc('https://www.netflix.com/title/100'), '201'), '100')
})

test('cache identifies series, season and episode through the episode season relationship', () => {
  const cache = { videos: {
    '201': { season: { $type: 'ref', value: ['videos', 150] }, title: { value: 'The Arrival' }, summary: { value: { type: 'episode', episodeNumber: 3 } } },
    '150': { series: { value: ['videos', 100] }, seasonNumber: { value: 2 } },
    '100': { title: 'A Series' },
  } }
  assert.deepEqual(playbackMetadataFromCache(cache, '201'), {
    episodeId: '201', seriesId: '100', titleName: 'A Series',
    episodeName: 'The Arrival', seasonNumber: 2, episodeNumber: 3,
  })
  assert.equal(playbackMetadataFromCache(cache, '202'), null)
})

test('direct episode details are normalized and do not confuse movies with episodes', () => {
  const video = { seriesId: 100, title: ' Pilot ', seasonNumber: { value: '1' }, episodeNumber: 2 }
  assert.deepEqual(playbackMetadataFromCache({ videos: { '201': video } }, '201'), {
    episodeId: '201', seriesId: '100', titleName: null,
    episodeName: 'Pilot', seasonNumber: 1, episodeNumber: 2,
  })
  for (const type of ['movie', 'show']) {
    assert.equal(playbackMetadataFromCache({ videos: { '201': { ...video, summary: { value: { type } } } } }, '201'), null)
  }
})

test('untrusted episode fields are bounded and malformed numbers remain unknown', () => {
  const message = { source: METADATA_SOURCE, episodeId: '201', seriesId: '100', episodeName: 'x'.repeat(500), seasonNumber: '2', episodeNumber: '4' }
  const parsed = parsePlaybackMetadata(message, '201')!
  assert.equal(parsed.episodeName?.length, 300)
  assert.equal(parsed.seasonNumber, 2)
  assert.equal(parsed.episodeNumber, 4)
  for (const value of [-1, 0, 1.5, Infinity, NaN, true, '', '2nd', {}, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = parsePlaybackMetadata({ ...message, seasonNumber: value, episodeNumber: value, episodeName: {} }, '201')!
    assert.deepEqual([invalid.seasonNumber, invalid.episodeNumber, invalid.episodeName], [null, null, null])
  }
})

test('structured metadata supplies names and numbers only for the current episode', () => {
  const data = { '@graph': [null, { '@type': ['TVEpisode'], url: 'https://www.netflix.com/watch/201', name: 'The Arrival', episodeNumber: '3',
    partOfSeason: { seasonNumber: 2, partOfSeries: { url: 'https://www.netflix.com/title/100', name: 'A Series' } },
  }] }
  const doc = metadataDoc('https://www.netflix.com/title/999', ['invalid', data])
  assert.deepEqual(resolveEpisodeMetadata(doc, '201'), {
    episodeId: '201', seriesId: '100', titleName: 'A Series',
    episodeName: 'The Arrival', seasonNumber: 2, episodeNumber: 3,
  })
  assert.equal(resolveSeriesId(doc, '201'), '100')
  assert.equal(resolveEpisodeMetadata(doc, '202'), null)
  assert.equal(resolveEpisodeMetadata(doc, '20'), null)
})

test('generic Netflix tab titles fall back to useful metadata', () => {
  const doc = { title: 'Netflix', querySelector: () => ({ getAttribute: () => 'A Series | Netflix' }) } as unknown as Document
  assert.equal(resolveTitleName(doc), 'A Series')
  assert.equal(resolveTitleName({ title: 'Netflix', querySelector: () => null } as unknown as Document), null)
})

// Shapes used by the player API readers in asbplayer and netflix-subtitle-study.
// These exercise the integration contract; live Netflix validation is separate.
test('player metadata resolves a watch ID absent from the bootstrap Falcor cache', () => {
  const video = { id: 100, type: 'show', title: 'A Series', seasons: [
    { seq: 1, episodes: [{ id: 200, seq: 1, title: 'Earlier' }] },
    { seq: 2, episodes: [{ id: 201, seq: 3, title: 'The Arrival' }, { id: 202, seq: 4, title: 'Next' }] },
  ] }
  const requested: number[] = []
  const netflix = {
    falcorCache: { videos: {} },
    appContext: { state: { playerApp: { getAPI() { return {
      getVideoMetadataByVideoId(id: number) { requested.push(id); return { _metadataObject: { video } } },
    } } } } },
  }
  assert.deepEqual(readPlaybackMetadata(netflix, '201'), {
    episodeId: '201', seriesId: '100', titleName: 'A Series', episodeName: 'The Arrival', seasonNumber: 2, episodeNumber: 3,
  })
  assert.deepEqual(readPlaybackMetadata(netflix, '202'), {
    episodeId: '202', seriesId: '100', titleName: 'A Series', episodeName: 'Next', seasonNumber: 2, episodeNumber: 4,
  })
  assert.equal(readPlaybackMetadata(netflix, '999'), null)
  assert.deepEqual(requested, [201, 202, 999])
})

test('player getters retain names and episode details even without a parent ID', () => {
  const current = {
    isEpisodic() { return true },
    getTitle() { return 'A Series' },
    getEpisodeTitle() { return 'The Arrival' },
    getEpisodeNumber() { return 3 },
    getSeason() { return { _season: { seq: 2 } } },
  }
  const api = { getVideoMetadataByVideoId() { return { getCurrentVideo() { return current } } } }
  const result = playbackMetadataFromPlayer(api, '201')
  assert.deepEqual(result, { episodeId: '201', seriesId: null, titleName: 'A Series', episodeName: 'The Arrival', seasonNumber: 2, episodeNumber: 3 })
  assert.deepEqual(parsePlaybackMetadata({ source: METADATA_SOURCE, ...result }, '201'), result)
  assert.equal(parsePlaybackMetadata({ source: METADATA_SOURCE, ...result }, '202'), null)
  assert.equal(parsePlaybackMetadata({ source: METADATA_SOURCE, episodeId: '201', seriesId: null }, '201'), null)
})

test('player metadata uses the current episode and rejects stale player data', () => {
  const api = { getVideoMetadataByVideoId() { return {
    getVideo() { return { _video: { id: 100, type: 'show', title: 'A Series' } } },
    getCurrentVideo() { return { _video: { id: 201, seq: 3, title: 'The Arrival' }, _season: { _season: { seq: 2 } } } },
  } } }
  assert.deepEqual(playbackMetadataFromPlayer(api, '201'), {
    episodeId: '201', seriesId: '100', titleName: 'A Series', episodeName: 'The Arrival', seasonNumber: 2, episodeNumber: 3,
  })
  assert.equal(playbackMetadataFromPlayer(api, '202'), null)
})

test('missing and throwing player APIs preserve the cache fallback', () => {
  const falcorCache = { videos: { '201': { seriesId: 100 }, '100': { title: 'A Series' } } }
  for (const playerApp of [undefined, { getAPI() { throw new Error('loading') } }, { getAPI() { return { getVideoMetadataByVideoId() { throw new Error('closed') } } } }]) {
    assert.equal(readPlaybackMetadata({ falcorCache, appContext: { state: { playerApp } } }, '201')?.seriesId, '100')
  }
  assert.equal(readPlaybackMetadata(undefined, '201'), null)
})

test('movies get a name without inventing a series or episode number', () => {
  const api = { getVideoMetadataByVideoId() { return { _metadataObject: { video: { id: 201, type: 'movie', title: 'A Film' } } } } }
  assert.deepEqual(playbackMetadataFromPlayer(api, '201'), {
    episodeId: '201', seriesId: null, titleName: 'A Film', ...unknownEpisode,
  })
})

test('merging partial metadata never mixes different episodes or conflicting series', () => {
  const primary = { episodeId: '201', seriesId: null, titleName: 'A Series', ...unknownEpisode }
  const fallback = { ...primary, seriesId: '100', episodeName: 'Pilot' }
  assert.deepEqual(mergePlaybackMetadata(primary, fallback), fallback)
  assert.deepEqual(mergePlaybackMetadata(primary, { ...fallback, episodeId: '202' }), primary)
  const conflicting = { ...primary, seriesId: '999' }
  assert.deepEqual(mergePlaybackMetadata(conflicting, fallback), conflicting)
})
