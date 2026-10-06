/* Compatibility bridge: the Studio command palette owns the command-center surface.
 * The historical default export and event name remain intact so existing modules can still import/dispatch them.
 */
export default function AdminCommandCenter() {
  return null;
}
