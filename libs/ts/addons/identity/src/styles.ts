/** The dialog's insides (Pipeup draws its frame); its colours are Pipeup's own, so both looks work. */
export const STYLES = `.dlg-t{margin:0 0 8px;font-size:15px;font-weight:600}
.dlg-b p{margin:0 0 8px;font-size:13px;line-height:1.5;color:var(--mu)}
.dlg-c{display:block;margin:8px 0;padding:8px 10px;border-radius:8px;background:var(--so);font:12px/1.6 ui-monospace,monospace;word-break:break-all;user-select:all}
.dlg-f{width:100%;margin:6px 0;padding:8px;border:1px solid var(--ln);border-radius:8px;background:var(--so);color:var(--k);font:12px/1.5 ui-monospace,monospace}
.dlg-m{min-height:1.2em;margin:4px 0;font-size:12px;color:var(--pu-accent)}
.dlg-a{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
.dlg-btn{padding:6px 12px;border:1px solid var(--ln);border-radius:8px;font-size:13px;color:var(--k);transition:background-color .2s var(--eo)}
.dlg-btn:hover,.dlg-btn:focus-visible{background:var(--ho);outline:none}
.dlg-btn.primary{border-color:var(--pu-accent);color:var(--pu-accent)}
.dlg-h{margin:12px 0 4px;font-size:13px;font-weight:600}
@media (pointer:coarse){.dlg-btn{min-height:40px}}`;
