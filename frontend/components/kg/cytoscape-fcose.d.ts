// cytoscape-fcose ships no type declarations. We only ever pass it to
// `cytoscape.use(...)` and reference the layout by its string name ('fcose'),
// so an opaque module declaration is sufficient.
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape'
  const ext: Ext
  export default ext
}
