# chat-launch-film

Stage a product launch inside one persistent chat window. A user asks for something, the assistant calls the product as a connected tool, progress cards run, a follow-up triggers a second action, and the result lands as a count-up headline number before a logo and call-to-action close. Output is a ~36 s 1920x1080 MP4 built with HyperFrames, plus an editable single-file project.

Install:

```
npx skills add SingleGrain-Team/video-skills@chat-launch-film
```

What is inside: `SKILL.md` (inputs, workflow, rules, validation) and `template/` (a parameterised `index.html` driven by one config object, with a placeholder logo).

Based on the persistent-chat-window storyboard approach in `cloud-render-launch/` and `figma-launch/` from https://github.com/heygen-com/hyperframes-launches (Apache-2.0, © HeyGen, Inc.). The chat window, timeline code and design are an original neutral implementation; no upstream media, logos or fonts are included.
