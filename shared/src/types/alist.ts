/** Alist 站点配置 */
export interface AlistServer {
  id: string;
  name: string;
  /** 站点地址，如 https://alist.example.com */
  serverUrl: string;
  /** 访问令牌（作为 Authorization 头或 password 字段） */
  token?: string;
  /** 根路径，默认 "/" */
  rootPath?: string;
  update_time?: number;
  is_deleted?: boolean;
}

/** Alist 文件系统项（目录列表 / 搜索结果） */
export interface AlistFsItem {
  name: string;
  is_dir: boolean;
  /** 父目录路径 */
  parent: string;
  size?: number;
  modified?: string;
}
