import * as React from 'react';

// The complete pinned Card tests contain a `props as never` fixture. React's
// overloaded factory infers its deprecated class-element overload for that
// fixture under the CMS checker. These references are function components;
// this host bridge preserves the same factory call and runtime element while
// exposing the common element type accepted by renderToStaticMarkup.
export function createElement<P extends object>(component: React.FunctionComponent<P>, props: P): React.ReactElement {
  return React.createElement(component, props) as React.ReactElement;
}
