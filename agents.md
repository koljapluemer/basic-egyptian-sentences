## Essential Tech Stack

- tailwind + Daisy UI. Actually use daisy components. Avoid manual CSS when possible.
- lucide icons (via the vue package)

## Guidelines

- Keep design lean. Use cards, wrapper divs and containers ONLY when necessary
- Keep style consistent across the code base
- Setup eslint and ensure green linter (not by disabling it, but by writing clean code)
- Keep files, functions and classes short, with a single purpose, on one abstraction layer. Split complex functionality when called for.
- Do not hallucinate features I did not ask for
- Keep copy and micro-copy short and to the point. Avoid waffling, avoid marketing speak, and avoid labelling everything with triple redundancy.
- make sure UI looks neat. Always put a form input BELOW the label in a new line. Responsive design.
- KEEP. IT. SIMPLE.
- always run `npm run build` and `npm run lint:fix` to ensure everything is well done. Fix problems by writing clean code, not by disabling the linter.


## UI Design

- Use Tailwind and Daisy.UI components
- Use wrapping components and especially cards sparingly, and only when needed.
- Prefer clean `grid` and `flex` layouts over `space-*`
- Do not use excessive subheadings, redundant labels or little information widgets that the user does not care about. 
- Before implementing a component, look for similar components and copy their styles and/or approach.
- When setting margins, paddings, gaps and so on, prefer the size `1`, `2`, `4`, and `6`
- For recurring complex styles, use `@apply` in `App.vue`.
- User color sparingly, and only for primary/important elements or those that must use color to communicate (e.g. a warning)
- Make sure any given layout works well on mobile and desktop!

- Use this pattern for form inputs:

- KEEP. IT. SIMPLE.