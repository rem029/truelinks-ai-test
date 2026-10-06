export interface UnitsTable {
  unit_id: string;
  label: string;
  type: string;
  area_sqm: number;
  parking_bay: string;
  status: string;
  building_id: string;
  building_name: string;
  property_id: string;
  property_name: string;
}

export interface RulesetsTable {
  version: string;
  name: string;
  rules_json: string;
  created_at: string;
  change_note: string;
}

export interface ConversationsTable {
  id: string;
  kind: string;
  unit_id: string | null;
  status: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessagesTable {
  id: string;
  conversation_id: string;
  role: string;
  text: string;
  cards_json: string;
  attachments_json: string;
  tool_calls_json: string | null;
  created_at: string;
}

export interface LeasesTable {
  id: string;
  conversation_id: string;
  unit_id: string | null;
  record_json: string;
  flags_json: string;
  rule_results_json: string;
  ruleset_version: string;
  status: string;
  analysis_status: string;
  override_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssuesTable {
  id: string;
  unit_id: string;
  conversation_id: string;
  reporter_role: string;
  note: string | null;
  photos_json: string;
  created_at: string;
}

export interface WorkOrdersTable {
  id: string;
  issue_id: string;
  unit_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  urgent: number;
  responsibility: string;
  responsibility_reason: string;
  responsibility_clause_json: string | null;
  lease_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentsTable {
  id: string;
  conversation_id: string;
  filename: string;
  mime_type: string;
  file_path: string;
  text_source: string;
  clause_split: string;
  page_count: number | null;
  clauses_json: string;
  created_at: string;
}

export interface Database {
  units: UnitsTable;
  rulesets: RulesetsTable;
  conversations: ConversationsTable;
  messages: MessagesTable;
  leases: LeasesTable;
  issues: IssuesTable;
  work_orders: WorkOrdersTable;
  documents: DocumentsTable;
}

