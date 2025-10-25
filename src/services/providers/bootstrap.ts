import { registerProvider } from './registry';
import { GenericProvider } from './generic';
import { RssProvider } from './rss';
import { YoutubeProvider } from './youtube';

export function initProviders() {
  const generic = new GenericProvider();
  registerProvider('generic', generic);
  // Concrete providers
  registerProvider('rss', new RssProvider());
  registerProvider('youtube', new YoutubeProvider());
  // Phase 1: stub providers using GenericProvider
  registerProvider('tiktok', generic);
  registerProvider('spotify', generic);
  registerProvider('applemusic', generic);
  registerProvider('deezer', generic);
  registerProvider('soundcloud', generic);
  registerProvider('tunein', generic);
  registerProvider('amazonmusic', generic);
  registerProvider('iheartradio', generic);
  registerProvider('audiomack', generic);
  registerProvider('podchaser', generic);
}


