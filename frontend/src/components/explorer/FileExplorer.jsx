import { ChevronDown, FileCode2, FolderOpen, GitBranch, MoreHorizontal, RefreshCw } from 'lucide-react'

function FileExplorer({ projectTitle, files, selectedFile, dirty, onSelect, onRefresh }) {
  return <aside className="explorer panel-light">
    <div className="panel-heading"><span>EXPLORER</span><button className="bare-button" onClick={onRefresh} title="Refresh files"><RefreshCw size={14} /></button></div>
    <div className="project-row"><ChevronDown size={14} /><span className="project-square" /><strong>{projectTitle || 'workspace'}</strong><MoreHorizontal size={15} /></div>
    <div className="file-list">{files.length ? files.map((file) => <button key={file} className={`file-row ${selectedFile === file ? 'active' : ''} ${!file.includes('.') ? 'folder-row' : ''}`} onClick={() => onSelect(file)}>{file.includes('.') ? <FileCode2 size={15} /> : <FolderOpen size={15} />}<span>{file}</span>{selectedFile === file && dirty && <i />}</button>) : <div className="small-empty">Loading workspace files…</div>}</div>
    <div className="explorer-bottom"><GitBranch size={14} /> main <span>·</span> clean</div>
  </aside>
}

export default FileExplorer
