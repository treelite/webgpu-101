# WebGPU 101 Examples

## Run it in local
```
$ npm install
$ npm run dev
```

Then access `http://localhost:3000` to view examples. Due to the WebGPU standard is still in draft and expected to change, all examples are only tested in the latest Chrome, please use Chrome to access these examples.

By default, the index page will display the first example which pointed to chapter 0. There is a `chapter` query parameter can be used to show other examples, like the chapter 1: `http://localhost:3000/?chapter=1`.

## FQA

### I only saw an empty page

Please open the console tab to check detailed errors.

### I saw "Please enable WebGPU" error

That's probably because the Chrome Origin Trials token was expired, please replace the existing one by your own token in the `index.html` file.
