const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

async function createTestVideo() {
  console.log('🎬 Creating sample test video with real spoken English audio...\n');

  const tempDir = path.join(process.cwd(), 'temp');
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const wavPath = path.join(tempDir, 'test_speech.wav');
  const mp4Path = path.join(publicDir, 'test_video.mp4');

  // Step 1: Generate spoken English WAV file using PowerShell SAPI
  const psScript = `
    Add-Type -AssemblyName System.Speech;
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
    $synth.SetOutputToWaveFile('${wavPath.replace(/\\/g, '\\\\')}');
    $synth.Speak('Hello and welcome to the dubbing test. This second sentence tests multi segment audio timing and alignment.');
    $synth.Dispose();
  `;

  console.log('1. Synthesizing spoken English voice audio track...');
  await execPromise(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
  console.log('   ✓ Speech audio generated:', wavPath);

  // Step 2: Combine speech audio with FFmpeg video test pattern
  console.log('2. Rendering MP4 video with test pattern and speech track...');
  const ffmpegCmd = `ffmpeg -y -f lavfi -i testsrc=duration=10:size=640x360:rate=30 -i "${wavPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${mp4Path}"`;
  
  await execPromise(ffmpegCmd);
  console.log('   ✓ Video created successfully:', mp4Path);

  console.log('\n🎉 Test video ready at:', mp4Path);
  console.log('   File location: public/test_video.mp4');
}

createTestVideo().catch(err => {
  console.error('Error creating test video:', err.message);
});
