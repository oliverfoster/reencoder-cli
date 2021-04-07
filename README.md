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
  "default": "1080",
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
        "@@outputDir/@@inputFileDir/@@inputFileNameSanitizedLowerCase.@@outputGroupName.mp4"
      ],
      "720": [
        "-vf", "scale=trunc(oh*a/2)*2:720",
        "-b:a", "128k",
        "-crf", 18,
        "-maxrate", "1M",
        "-r", 24,
        "-profile:v", "high",
        "-tune", "film",
        "-level", "4.1",
        "-movflags", "+faststart",
        "-bufsize", "2M",
        "-ac", 2,
        "-ar", 44100,
        "@@outputDir/@@inputFileDir/@@inputFileNameSanitizedLowerCase.@@outputGroupName.mp4"
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
        "@@outputDir/@@inputFileDir/@@inputFileNameSanitizedLowerCase.@@outputGroupName.mp4"
      ]
    }
  ]
}
```

### Execution

With default output:
```sh
$ reencode
```

With specified outputs:
```sh
$ reencode 1080 720 480
```
