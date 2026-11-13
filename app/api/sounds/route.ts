import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SoundEffectType, DEFAULT_SOUND_FILES } from '@/lib/sound-effects';

export const dynamic = 'force-dynamic';

const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i;

const SUBFOLDER_ALIASES: Record<SoundEffectType, string[]> = {
  'menu-open': ['menu-open', 'abrir-menu'],
  'menu-close': ['menu-close', 'fechar-menu'],
  'accordion-open': ['accordion-open', 'abrir-item', 'abrir'],
  'accordion-close': ['accordion-close', 'fechar-item', 'fechar'],
  'feedback-step': ['feedback-step', 'passada-feedback', 'feedback', 'passadas'],
};

const FILENAME_PATTERNS: Record<SoundEffectType, RegExp> = {
  'menu-open': /(menu.*(open|abr)|abr.*menu)/i,
  'menu-close': /(menu.*(close|fech)|fech.*menu)/i,
  'accordion-open': /((accordion|item|sobre|secao).*(open|abr)|^abrir)/i,
  'accordion-close': /((accordion|item|sobre|secao).*(close|fech)|^fechar)/i,
  'feedback-step': /(feedback|passad|step|click|tick|carrossel|roleta)/i,
};

export async function GET() {
  try {
    const soundsDir = path.join(process.cwd(), 'public', 'sounds');
    if (!fs.existsSync(soundsDir)) {
      return NextResponse.json({ sounds: DEFAULT_SOUND_FILES });
    }

    const entries = fs.readdirSync(soundsDir, { withFileTypes: true });
    const rootAudioFiles = entries
      .filter((e) => e.isFile() && AUDIO_EXT_REGEX.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const resolved: Record<SoundEffectType, string> = { ...DEFAULT_SOUND_FILES };
    const types: SoundEffectType[] = [
      'menu-open',
      'menu-close',
      'accordion-open',
      'accordion-close',
      'feedback-step',
    ];

    const usedRootFiles = new Set<string>();

    // 1. Check dedicated subfolders first (allows dropping any audio file without renaming)
    for (const type of types) {
      for (const folderName of SUBFOLDER_ALIASES[type]) {
        const subDir = path.join(soundsDir, folderName);
        if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
          const subFiles = fs
            .readdirSync(subDir)
            .filter((f) => AUDIO_EXT_REGEX.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          if (subFiles.length > 0) {
            resolved[type] = `/sounds/${encodeURIComponent(folderName)}/${encodeURIComponent(
              subFiles[0]
            )}`;
            break;
          }
        }
      }
    }

    // 2. Match files placed directly in /public/sounds by keyword pattern
    for (const type of types) {
      const match = rootAudioFiles.find(
        (f) => !usedRootFiles.has(f) && FILENAME_PATTERNS[type].test(f)
      );
      if (match) {
        usedRootFiles.add(match);
        resolved[type] = `/sounds/${encodeURIComponent(match)}`;
      }
    }

    // 3. Any remaining custom audio files with arbitrary names in /public/sounds override remaining slots
    const remainingFiles = rootAudioFiles.filter((f) => !usedRootFiles.has(f));
    if (remainingFiles.length > 0) {
      for (let i = 0; i < types.length && i < remainingFiles.length; i++) {
        const t = types[i];
        if (!usedRootFiles.has(path.basename(resolved[t]))) {
          resolved[t] = `/sounds/${encodeURIComponent(remainingFiles[i])}`;
        }
      }
    }

    return NextResponse.json({
      sounds: resolved,
      availableFiles: rootAudioFiles.map((f) => `/sounds/${encodeURIComponent(f)}`),
    });
  } catch {
    return NextResponse.json({ sounds: DEFAULT_SOUND_FILES });
  }
}
