# reencoder-cli

Batch video reencode with ffmpeg and ffprobe. Project local configurations. Configurations variations. Glob support.

## Installation
### Globally as a *cli*

`npm install -g reencoder-cli`

### Locally as a *library*

`npm install -s reencoder-cli`

## Configuration

Add `.reencoderrc.json` to the execution directory or any of its parents. 
See examples in the ['examples/'](https://github.com/oliverfoster/reencoder-cli/tree/master/examples) directory.
```json
{
  "description": "The example is for repeatedly converting and collating videos in nested subdirectories to a uniform format, 1080p, 720p or 480p.",
  "description": "It will skip files which exist in the output dir already and it will not clear the output folder.",
  "inputDir": "./",
  "outputDir": "./Converted",
  "clearOutputDir": false,
  "default": "720",
  "concurrency": 1,
  "parameters": [
    "-hwaccel", "auto",
    "-i", "@@inputDir/**/*@(.mp4|.mov|.avi|.wmv)",
    {
      "1080": [
        "-vf", "scale=trunc(oh*a/2)*2:1080",
        "-maxrate", "2M",
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
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "720": [
        "-vf", "scale=trunc(oh*a/2)*2:720",
        "-maxrate", "1.2M",
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
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
      ],
      "480": [
        "-vf", "scale=trunc(oh*a/2)*2:480",
        "-maxrate", "0.8M",
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
        "@@outputDir/@@inputFileName.@@outputGroupName.mp4"
      ]
    }
  ]
}
```

### Options
**_default_** : Defaults to `''`. Specifies which named groups should run. If unspecified will run all groups.<br>
**_inputDir_** : Defaults to `'./'`.<br>
**_outputDir_** : Defaults to `'./Converted'`.<br>
**_concurrency_** : Defaults to `1`. Specifies the number of encodes to run in parallel.<br>
**_clearOutputDir_** : Defaults to `false`.<br>

### Parameters

#### Irregular

**_-i_** : The standard input parameter for ffmpeg is a [glob](https://github.com/isaacs/node-glob).<br>
**_-y_** : The absence of `-y` assumes `-n`, which instead of overwriting is to skip without prompt.

Reference: [main options](http://ffmpeg.org/ffmpeg.html#Main-options)

#### Objects

Parameters included as named values of objects will be included in the ffmpeg execution parameters only when their name matches, (when a *library*) an entry in the `outputGroupNames` variable, or (when a *cli*) arguments in the terminal.<br>

This allows for some simple configuration variations.<br>

Objects can be nested.<br>

#### String replacement
Available string replacement variables are declared [here](https://github.com/oliverfoster/reencoder-cli/blob/c710b8b4c97586bec612ca480561679294c7ab2b/app/parameters.js#L93-L103):

**_@@inputFile_** : Absolute input file path.<br>
**_@@inputFileBase_** : Full file name, including extension.<br>
**_@@inputFileBaseSanitized_** : Full file name, including extension, with special characters and spaces removed.<br>
**_@@inputFileBaseSanitizedLowerCase_** : Full file name, including extension, with special characters and spaces removed, lowercase.<br>
**_@@inputFileDir_** : Sub directory relative to `inputDir`.<br>
**_@@inputFileExt_** : File extension.<br>
**_@@inputFileName_** : Front part of the file name.<br>
**_@@inputFileNameSanitized_** : Front part of the file name, with special characters and spaces removed.<br>
**_@@inputFileNameSanitizedLowerCase_** : Front part of the file name, with special characters and spaces removed, lowercase.<br>
**_@@outputDir_** : Absolute output file path.<br>
**_@@outputGroupName_** : Nested configuration name.<br>


## Execution

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
const promise = reencode({
  config, // Config can be specified here, or it will be fetched from .reencoderrc.json through parent directories
  status = (state) => console.log( // Outputs to console: reencode 6.25% 1/3 18.75% nested/one.mp4
    state.mode,
    state.totalPercentComplete,
    `${state.currentItem}/${state.total}`,
    state.currentPercentComplete,
    state.currentInputFile
  )
})
await promise; // promise.kill() will prematurely terminate the reencoding
```
