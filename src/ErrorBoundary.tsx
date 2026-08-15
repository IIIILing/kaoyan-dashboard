import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * 全局错误边界:任何渲染异常都不应让整个仪表盘白屏。
 * 数据始终安全地保存在浏览器 localStorage 中,这里提供
 * 「重新加载」与「导出本机全部数据」两个恢复出口。
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留错误细节,便于排查;不抛出以免二次崩溃。
    console.error("[kaoyan-dashboard] 渲染异常:", error, info.componentStack);
  }

  private exportAllLocalData() {
    const bundle: Record<string, unknown> = {};
    let count = 0;
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith("kaoyan-dashboard")) continue;
        const raw = window.localStorage.getItem(key);
        if (raw === null) continue;
        try {
          bundle[key] = JSON.parse(raw);
        } catch {
          bundle[key] = raw;
        }
        count += 1;
      }
    } catch (error) {
      console.error("[kaoyan-dashboard] 读取本机数据失败:", error);
    }
    const payload = JSON.stringify(
      { kind: "kaoyan-dashboard-full-recovery", exportedAt: new Date().toISOString(), keys: bundle },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kaoyan-dashboard-全量备份-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    window.alert(`已导出 ${count} 个本机数据项。请妥善保存该文件,后续可在「设置 → 导入备份」恢复。`);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error;
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠️</div>
          <h1 style={styles.title}>页面遇到了一点问题</h1>
          <p style={styles.copy}>
            你的学习数据仍然安全地保存在当前浏览器的本机存储中,并没有丢失。
            可以重新加载页面继续使用;如果问题反复出现,请先导出本机数据再联系维护者。
          </p>
          <details style={styles.details}>
            <summary>查看错误详情</summary>
            <pre style={styles.pre}>{error.name}: {error.message}</pre>
          </details>
          <div style={styles.actions}>
            <button type="button" style={styles.primaryButton} onClick={() => window.location.reload()}>
              重新加载页面
            </button>
            <button type="button" style={styles.secondaryButton} onClick={() => this.exportAllLocalData()}>
              导出本机全部数据
            </button>
          </div>
          <p style={styles.footnote}>数据不会上传到任何服务器。</p>
        </div>
      </div>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#f4f3ef",
    color: "#172532",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  card: {
    width: "min(520px, 100%)",
    padding: "32px 28px",
    borderRadius: 14,
    background: "#fffefa",
    boxShadow: "0 18px 50px rgba(0,0,0,.12)",
  },
  icon: { fontSize: 34, lineHeight: 1 },
  title: { fontSize: 20, margin: "14px 0 8px" },
  copy: { fontSize: 13.5, lineHeight: 1.7, margin: 0, color: "#4a5560" },
  details: { marginTop: 14, fontSize: 12.5, color: "#6c7882" },
  pre: {
    margin: "8px 0 0",
    padding: 10,
    borderRadius: 8,
    background: "#f0eeea",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    color: "#8b3a3a",
  },
  actions: { display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" },
  primaryButton: {
    padding: "10px 18px",
    border: "none",
    borderRadius: 9,
    background: "#003b70",
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 18px",
    border: "1px solid #c9c4bb",
    borderRadius: 9,
    background: "transparent",
    color: "#172532",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  footnote: { margin: "18px 0 0", fontSize: 11.5, color: "#9aa2ab" },
};
