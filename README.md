# reencoder-cli

Batch video reencode with ffmpeg and ffprobe.
Both a *library* and *cli*.

### Installation
##### Globally as a *cli*

`npm install -g reencoder-cli`

##### Locally as a *library*

`npm install -s reencoder-cli`

### Configuration

Add `.reencoderrc.json` to the execution directory or any of its parents. 

```json
{
  "inputDir": "./",
  "outputDir": "./converted",
  "clearOutputDir": false,
  "default": "720",
  "parameters": [
    "-y",
    "-hwaccel", "auto",
    "-i", "@@inputDir/**/*@(.mp4|.mov|.avi|.wmv)",
    {
      "1080": [
        "-vf", "scale=trunc(oh*a/2)*2:1080",
        "-b:a", "128k",
        "-crf", 18,
        "-maxrate", "2M",
        "-r", 24,
        "-profile:v", "high",
        "-tune", "film",
        "-level", "4.1",
        "-movflags", "+faststart",
        "-bufsize", "2M",
        "-ac", 2,
        "-ar", 44100,
        "@@outputDir/@@inputFileDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "720": [
        "-vf", "scale=trunc(oh*a/2)*2:720",
        "-b:a", "128k",
        "-crf", 18,
        "-maxrate", "1.2M",
        "-r", 24,
        "-profile:v", "high",
        "-tune", "film",
        "-level", "4.1",
        "-movflags", "+faststart",
        "-bufsize", "2M",
        "-ac", 2,
        "-ar", 44100,
        "@@outputDir/@@inputFileDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "480": [
        "-vf", "scale=trunc(oh*a/2)*2:480",
        "-b:a", "128k",
        "-crf", 18,
        "-maxrate", "0.8M",
        "-r", 24,
        "-profile:v", "high",
        "-tune", "film",
        "-level", "4.1",
        "-movflags", "+faststart",
        "-bufsize", "2M",
        "-ac", 2,
        "-ar", 44100,
        "@@outputDir/@@inputFileDir/@@inputFileName.@@outputGroupName.mp4"
      ]
    }
  ]
}
```

### Execution

With default output:
```sh
$ reencoder
```

With specified outputs:
```sh
$ reencoder 1080 720 480
```

As a library:
```js
const { reencode, getConfig } = require('reencoder-cli')
const config = getConfig(); // Lookup .reencoderrc.json
await reencode({
    config, // Config can be specified here, or it will be fetched from .reencoderrc.json through parent directories
    outputGroupNames, // Uses config.default as default to specify which named subtasks should run
    inputDir, // Uses './' as default if unspecified in config
    outputDir, // Uses './reencoder' as default if unspecified in config
    status = (state) => console.log( // Outputs to console: 6.25% 1/3 18.75% nested/one.mp4
      state.totalPercentComplete,
      `${state.currentItem}/${state.total}`,
      state.currentPercentComplete,
      state.currentInputFile
    )
  })
```
