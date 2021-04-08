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
See examples in the ['examples/'](https://github.com/oliverfoster/reencoder-cli/tree/master/examples) directory.
```json
{
  "description": "The example is for repeatedly converting and collated videos in nested subdirectories to a uniform format, 1080p, 720p or 480p.",
  "description": "It will skip files which exist in the output dir already and it will not clear the output folder.",
  "inputDir": "./",
  "outputDir": "./Converted",
  "clearOutputDir": false,
  "default": "720",
  "concurrency": 1,
  "parameters": [
    "-hwaccel", "auto",
    "-i", "@@inputDir/**/*@(.mp4|.mov|.avi|.wmv)",
    "-preset", "fast",
    "-b:a", "128k",
    "-r", 24,
    "-profile:v", "high",
    "-tune", "film",
    "-level", "4.1",
    "-movflags", "+faststart",
    "-bufsize", "2M",
    "-ac", 2,
    "-ar", 44100,
    {
      "1080": [
        "-vf", "scale=trunc(oh*a/2)*2:1080",
        "-maxrate", "2M",
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "720": [
        "-vf", "scale=trunc(oh*a/2)*2:720",
        "-maxrate", "1.2M",
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "480": [
        "-vf", "scale=trunc(oh*a/2)*2:480",
        "-maxrate", "0.8M",
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
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
  status = (state) => console.log( // Outputs to console: reencode 6.25% 1/3 18.75% nested/one.mp4
    state.mode,
    state.totalPercentComplete,
    `${state.currentItem}/${state.total}`,
    state.currentPercentComplete,
    state.currentInputFile
  )
})
```
