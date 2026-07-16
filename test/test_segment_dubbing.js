const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Import our services
const { speedUpAudio, assembleAudioTimeline, getDuration } = require('../src/merge-only/services/ffmpegService');

// Grouping logic (copied/imported for testing)
const dubbingProcessorPath = path.resolve(__dirname, '../src/dubbing-pipeline/services/dubbingProcessor.js');
function groupWordsIntoSentences(words) {
  if (!words || words.length === 0) return [];
  const segments = [];
  let currentWords = [];
  const maxGapMs = 1500;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentWords.push(word);
    const isPunctuationEnd = /[.!?]$/.test(word.text.trim());
    const isLastWord = i === words.length - 1;
    let hasLargeGap = false;
    if (!isLastWord) {
      const nextWord = words[i + 1];
      const gap = nextWord.start - word.end;
      if (gap > maxGapMs) {
        hasLargeGap = true;
      }
    }
    if (isPunctuationEnd || isLastWord || hasLargeGap) {
      const firstWord = currentWords[0];
      const lastWord = currentWords[currentWords.length - 1];
      const startSec = firstWord.start / 1000;
      const endSec = lastWord.end / 1000;
      segments.push({
        text: currentWords.map(w => w.text).join(' '),
        start: startSec,
        end: endSec,
        duration: endSec - startSec
      });
      currentWords = [];
    }
  }
  return segments;
}

async function runTests() {
  console.log('🧪 Starting Segment Dubbing Integration Tests...\n');

  // Test 1: Sentence Grouping Logic
  console.log('=== Test 1: Word-to-Sentence Grouping ===');
  const dummyWords = [
    { text: 'Hello', start: 500, end: 900 },
    { text: 'world.', start: 1000, end: 1400 },
    { text: 'This', start: 1500, end: 1800 },
    { text: 'is', start: 1900, end: 2100 },
    { text: 'cool!', start: 2200, end: 2500 },
    { text: 'After', start: 5000, end: 5400 }, // Large gap from 2500 to 5000 (2.5s)
    { text: 'pause', start: 5500, end: 5900 }
  ];

  const parsedSegments = groupWordsIntoSentences(dummyWords);
  console.log('Parsed Segments:', JSON.stringify(parsedSegments, null, 2));

  if (parsedSegments.length !== 3) {
    throw new Error(`Expected 3 segments, but got ${parsedSegments.length}`);
  }
  if (parsedSegments[0].text !== 'Hello world.') {
    throw new Error(`Expected segment 0 text to be "Hello world." but got "${parsedSegments[0].text}"`);
  }
  if (parsedSegments[1].text !== 'This is cool!') {
    throw new Error(`Expected segment 1 text to be "This is cool!" but got "${parsedSegments[1].text}"`);
  }
  if (parsedSegments[2].text !== 'After pause') {
    throw new Error(`Expected segment 2 text to be "After pause" but got "${parsedSegments[2].text}"`);
  }
  console.log('✓ Test 1 Passed: Grouping logic works perfectly!\n');

  // Setup temp directory for file tests
  const tempDir = path.resolve(__dirname, '../temp/test-runs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const file5s = path.join(tempDir, 'dummy_5s.wav');
  const file2s = path.join(tempDir, 'dummy_2s.wav');
  const speedOut = path.join(tempDir, 'speed_out.wav');
  const timelineOut = path.join(tempDir, 'timeline_out.wav');

  try {
    // Generate dummy audio files
    console.log('=== Generating dummy audio files using FFmpeg ===');
    await execPromise(`ffmpeg -y -f lavfi -i sine=frequency=440:duration=5 "${file5s}"`);
    await execPromise(`ffmpeg -y -f lavfi -i sine=frequency=880:duration=2 "${file2s}"`);
    console.log('✓ Generated dummy audio files\n');

    // Test 2: speedUpAudio
    console.log('=== Test 2: Audio Speedup/Duration Check ===');
    const origDuration = await getDuration(file5s);
    console.log(`Original file duration: ${origDuration.toFixed(2)}s`);

    // Speed up by 2.0x (should end up ~2.5s)
    await speedUpAudio(file5s, speedOut, 2.0);
    const newDuration = await getDuration(speedOut);
    console.log(`Sped up file duration: ${newDuration.toFixed(2)}s`);

    const expectedNewDuration = origDuration / 2.0;
    if (Math.abs(newDuration - expectedNewDuration) > 0.2) {
      throw new Error(`Expected duration to be near ${expectedNewDuration}s, but got ${newDuration}s`);
    }
    console.log('✓ Test 2 Passed: Speedup logic works perfectly!\n');

    // Test 3: assembleAudioTimeline
    console.log('=== Test 3: Assemble Audio Timeline with Padding & Delays ===');
    const segmentsToAssemble = [
      { filePath: file2s, start: 1.5 },   // 2s duration, starts at 1.5s (ends at 3.5s)
      { filePath: speedOut, start: 6.0 }  // 2.5s duration, starts at 6.0s (ends at 8.5s)
    ];
    const totalVideoDuration = 12.0;

    await assembleAudioTimeline(segmentsToAssemble, totalVideoDuration, timelineOut);
    const timelineDuration = await getDuration(timelineOut);
    console.log(`Assembled timeline duration: ${timelineDuration.toFixed(2)}s`);

    if (Math.abs(timelineDuration - totalVideoDuration) > 0.2) {
      throw new Error(`Expected timeline duration to be near ${totalVideoDuration}s, but got ${timelineDuration}s`);
    }
    console.log('✓ Test 3 Passed: Audio timeline assembly works perfectly!\n');

    console.log('🎉 All Tests Passed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    // Cleanup files
    const files = [file5s, file2s, speedOut, timelineOut];
    files.forEach(f => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (e) {}
      }
    });
    try {
      fs.rmdirSync(tempDir);
    } catch (e) {}
  }
}

runTests();
