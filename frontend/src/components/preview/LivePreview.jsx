import { LoaderCircle, Monitor, MoreHorizontal, RefreshCw } from 'lucide-react'

function LivePreview({ previewUrl, loading, previewKey, onRefresh, onLoad }) {
  return <section className="preview-card panel-light">
    <div className="preview-header"><span><Monitor size={14} /> LIVE PREVIEW</span><div><button title="Refresh preview" onClick={onRefresh}><RefreshCw size={14} /></button><button title="Open preview" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}><MoreHorizontal size={16} /></button></div></div>
    <div className="browser-bar"><span className="browser-lights"><i /><i /><i /></span><span>{previewUrl.replace('http://', '')}</span></div>
    <div className="preview-frame">{loading && <div className="preview-loading"><LoaderCircle className="spin" size={18} /> Loading preview…</div>}<iframe key={previewKey} title="Live sandbox preview" src={previewUrl} onLoad={onLoad} /></div>
  </section>
}

export default LivePreview
