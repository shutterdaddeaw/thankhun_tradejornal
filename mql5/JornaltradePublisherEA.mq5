//+------------------------------------------------------------------+
//|                                     JornaltradePublisherEA.mq5    |
//|                                  Copyright 2026, THANKHUN EA     |
//|                                  https://github.com/thankhun     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, THANKHUN EA"
#property link      "https://github.com/thankhun"
#property version   "1.00"
#property description "Lightweight MT5 Trading Portfolio Syncer for Jornaltrade backend"
#property description "Attach to a single chart to publish account deals and positions."

//--- Input parameters
input string   InpServerUrl           = "https://cargo-railway-genre.ngrok-free.dev"; // Server URL (FastAPI backend)
input string   InpPublisherToken      = "PASTE_YOUR_TOKEN_HERE"; // Publisher Token (from Web App)
input int      InpSyncInterval        = 60;                      // Snapshot Sync Interval (seconds)
input int      InpHeartbeatInterval   = 120;                     // Heartbeat Interval (seconds)
input bool     InpEnableDiscordNotify = false;                   // Enable Discord Notifications
input string   InpDiscordWebhookUrl   = "PASTE_YOUR_WEBHOOK_HERE"; // Discord Webhook URL
input bool     InpVerboseLogging      = false;                   // Enable Verbose Logging

//--- Global variables
string   g_account_id_str;
string   g_gv_bootstrapped_name;
string   g_gv_last_ticket_name;
datetime g_last_snapshot_time = 0;
datetime g_last_heartbeat_time = 0;
datetime g_last_error_log_time = 0;
bool     g_was_previously_connected = true;
bool     g_was_discord_connected = true;

//+------------------------------------------------------------------+
//| Helper: Format time as ISO 8601 string                           |
//+------------------------------------------------------------------+
string TimeToISO(datetime time)
{
   MqlDateTime dt;
   TimeToStruct(time, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d", dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
//| Helper: Clean string for JSON embedding (escapes quotes)        |
//+------------------------------------------------------------------+
string CleanString(string text)
{
   string clean = text;
   StringReplace(clean, "\"", "'");
   StringReplace(clean, "\\", "/");
   return clean;
}

//+------------------------------------------------------------------+
//| Helper: Post HTTP WebRequest                                     |
//+------------------------------------------------------------------+
bool SendPostRequest(string endpoint, string payload)
{
   string url = InpServerUrl + endpoint;
   string headers = "Content-Type: application/json\r\n" +
                    "X-Publisher-Token: " + InpPublisherToken + "\r\n";
                    
   char post_data[];
   char result_data[];
   string result_headers;
   
   int copied = StringToCharArray(payload, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0)
   {
      ArrayResize(post_data, copied - 1);
   }
   
   ResetLastError();
   int res = WebRequest("POST", url, headers, 10000, post_data, result_data, result_headers);
   
   if(res == -1)
   {
      int error_code = GetLastError();
      if(g_was_previously_connected)
      {
         Print("Jornaltrade Error: WebRequest failed to ", url, ". Error code: ", error_code);
         if(error_code == 4014)
         {
            Print("Jornaltrade Warning: URL '", InpServerUrl, "' is not allowed in MT5. Go to Tools -> Options -> Expert Advisors and add it to WebRequest list.");
         }
         g_was_previously_connected = false;
      }
      return false;
   }
   
   if(res < 200 || res >= 300)
   {
      if(g_was_previously_connected)
      {
         string response = CharArrayToString(result_data, 0, WHOLE_ARRAY, CP_UTF8);
         StringReplace(response, "\r", " ");
         StringReplace(response, "\n", " ");
         if(StringLen(response) > 120)
         {
            response = StringSubstr(response, 0, 120) + "... [truncated]";
         }
         Print("Jornaltrade HTTP Warning: Server responded with status ", res, " on ", endpoint, ". Response: ", response);
         g_was_previously_connected = false;
      }
      return false;
   }
   
   if(!g_was_previously_connected)
   {
      Print("Jornaltrade Info: Reconnected to backend server successfully.");
      g_was_previously_connected = true;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Helper: Format holding duration into readable string             |
//+------------------------------------------------------------------+
string FormatDuration(int total_seconds)
{
   if(total_seconds < 0) total_seconds = 0;
   
   int days = total_seconds / 86400;
   int remainder = total_seconds % 86400;
   int hours = remainder / 3600;
   remainder = remainder % 3600;
   int minutes = remainder / 60;
   int seconds = remainder % 60;
   
   if(days > 0)
      return StringFormat("%dd %dh %dm", days, hours, minutes);
   if(hours > 0)
      return StringFormat("%dh %dm %ds", hours, minutes, seconds);
   if(minutes > 0)
      return StringFormat("%dm %ds", minutes, seconds);
      
   return StringFormat("%ds", seconds);
}

//+------------------------------------------------------------------+
//| Helper: Find time when position was originally opened            |
//+------------------------------------------------------------------+
datetime GetPositionOpenTime(ulong position_id)
{
   if(position_id == 0) return 0;
   
   if(!HistorySelectByPosition(position_id)) return 0;
   
   int total_deals = HistoryDealsTotal();
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0)
      {
         long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(entry == DEAL_ENTRY_IN)
         {
            return (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
         }
      }
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Core Action: Send Discord Webhook Notification                  |
//+------------------------------------------------------------------+
bool SendDiscordNotification(string message_json)
{
   if(!InpEnableDiscordNotify || InpDiscordWebhookUrl == "PASTE_YOUR_WEBHOOK_HERE" || InpDiscordWebhookUrl == "")
      return true;

   string headers = "Content-Type: application/json\r\n";
   char post_data[];
   char result_data[];
   string result_headers;
   
   int copied = StringToCharArray(message_json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0)
   {
      ArrayResize(post_data, copied - 1);
   }
   
   ResetLastError();
   // Shorter timeout of 5000ms for Discord Webhook
   int res = WebRequest("POST", InpDiscordWebhookUrl, headers, 5000, post_data, result_data, result_headers);
   
   if(res == -1)
   {
      int error_code = GetLastError();
      if(g_was_discord_connected)
      {
         Print("Jornaltrade Discord Error: WebRequest to Discord failed. Error code: ", error_code);
         g_was_discord_connected = false;
      }
      return false;
   }
   
   if(res < 200 || res >= 300)
   {
      if(g_was_discord_connected)
      {
         string response = CharArrayToString(result_data, 0, WHOLE_ARRAY, CP_UTF8);
         StringReplace(response, "\r", " ");
         StringReplace(response, "\n", " ");
         if(StringLen(response) > 120)
         {
            response = StringSubstr(response, 0, 120) + "...";
         }
         Print("Jornaltrade Discord Warning: Discord responded with status ", res, ". Response: ", response);
         g_was_discord_connected = false;
      }
      return false;
   }
   
   if(!g_was_discord_connected)
   {
      Print("Jornaltrade Discord Info: Discord notifications re-established successfully.");
      g_was_discord_connected = true;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Core Action: Process trade deal and post to Discord Embed       |
//+------------------------------------------------------------------+
void ProcessDiscordNotify(ulong ticket)
{
   if(!InpEnableDiscordNotify || InpDiscordWebhookUrl == "PASTE_YOUR_WEBHOOK_HERE" || InpDiscordWebhookUrl == "")
      return;
      
   if(!HistoryDealSelect(ticket)) return;
   
   long type      = HistoryDealGetInteger(ticket, DEAL_TYPE);
   long entry     = HistoryDealGetInteger(ticket, DEAL_ENTRY);
   double volume  = HistoryDealGetDouble(ticket, DEAL_VOLUME);
   double price   = HistoryDealGetDouble(ticket, DEAL_PRICE);
   double comm    = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
   double swap    = HistoryDealGetDouble(ticket, DEAL_SWAP);
   double profit  = HistoryDealGetDouble(ticket, DEAL_PROFIT);
   string symbol  = HistoryDealGetString(ticket, DEAL_SYMBOL);
   string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
   long magic     = HistoryDealGetInteger(ticket, DEAL_MAGIC);
   ulong pos_id   = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
   
   // Skip non-trade deals
   if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) return;
   
   string action_str = "";
   string emoji = "";
   int embed_color = 0;
   
   string type_str = (type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   string broker  = CleanString(AccountInfoString(ACCOUNT_COMPANY));
   string num     = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string accName = CleanString(AccountInfoString(ACCOUNT_NAME));
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   
   if(entry == DEAL_ENTRY_IN)
   {
      action_str = "Opened";
      emoji = (type == DEAL_TYPE_BUY) ? "🟢" : "🔴";
      embed_color = (type == DEAL_TYPE_BUY) ? 3066993 : 15158332; // Green or Red
      
      // Attempt to retrieve SL / TP of the position
      double sl = 0.0;
      double tp = 0.0;
      if(PositionSelectByTicket(pos_id))
      {
         sl = PositionGetDouble(POSITION_SL);
         tp = PositionGetDouble(POSITION_TP);
      }
      
      string description = StringFormat(
         "**Broker:** %s\\n**Account:** %s (%s)\\n**Balance:** %.2f %s 💵\\n**Type:** %s\\n**Volume:** %.2f Lots\\n**Open Price:** %.5f\\n**SL / TP:** %.5f / %.5f\\n**Trading EA:** %s (Magic: %I64d)",
         broker, num, accName, balance, AccountInfoString(ACCOUNT_CURRENCY), type_str, volume, price, sl, tp, CleanString(comment), magic
      );
      
      string title = StringFormat("%s [%s] %s - %s", emoji, type_str, action_str, symbol);
      string embed_json = StringFormat(
         "{\"embeds\":[{\"title\":\"%s\",\"description\":\"%s\",\"color\":%d}]}",
         title, description, embed_color
      );
      
      SendDiscordNotification(embed_json);
   }
   else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
   {
      action_str = (entry == DEAL_ENTRY_OUT) ? "Closed" : "Reversed";
      double net_profit = profit + comm + swap;
      emoji = (net_profit >= 0) ? "💰" : "📉";
      embed_color = (net_profit >= 0) ? 3066993 : 15158332; // Green or Red
      
      // Calculate holding time
      string duration_str = "Unknown";
      datetime open_time = GetPositionOpenTime(pos_id);
      datetime close_time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      if(open_time > 0 && close_time >= open_time)
      {
         duration_str = FormatDuration((int)(close_time - open_time));
      }
      
      string profit_emoji = (net_profit >= 0) ? "🟢" : "🔴";
      
      string description = StringFormat(
         "**Broker:** %s\\n**Account:** %s (%s)\\n**Balance:** %.2f %s 💵\\n**Type:** %s\\n**Volume:** %.2f Lots\\n**Close Price:** %.5f\\n**Holding Time:** %s ⏱️\\n**Gross Profit:** %.2f\\n**Commission / Swap:** %.2f / %.2f\\n**Net Profit:** **%.2f %s** %s\\n**Trading EA:** %s (Magic: %I64d)",
         broker, num, accName, balance, AccountInfoString(ACCOUNT_CURRENCY), type_str, volume, price, duration_str, profit, comm, swap, net_profit, AccountInfoString(ACCOUNT_CURRENCY), profit_emoji, CleanString(comment), magic
      );
      
      string title = StringFormat("%s [%s] %s - %s", emoji, type_str, action_str, symbol);
      string embed_json = StringFormat(
         "{\"embeds\":[{\"title\":\"%s\",\"description\":\"%s\",\"color\":%d}]}",
         title, description, embed_color
      );
      
      SendDiscordNotification(embed_json);
   }
}

//+------------------------------------------------------------------+
//| Core Action: Bootstrap History (Send all past deals)            |
//+------------------------------------------------------------------+
bool BootstrapHistory()
{
   if(InpVerboseLogging) Print("Jornaltrade: Starting history bootstrap...");
   
   // Select entire history from account opening to now
   if(!HistorySelect(0, TimeCurrent()))
   {
      if(g_was_previously_connected)
      {
         Print("Jornaltrade Error: Failed to load account history.");
         g_was_previously_connected = false;
      }
      return false;
   }
   
   int total_deals = HistoryDealsTotal();
   if(InpVerboseLogging) Print("Jornaltrade: Formatting ", total_deals, " historical deals...");
   
   string deals_json = "";
   ulong last_synced_ticket = 0;
   
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;
      
      long type      = HistoryDealGetInteger(ticket, DEAL_TYPE);
      long entry     = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      long magic     = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      long order     = HistoryDealGetInteger(ticket, DEAL_ORDER);
      long position  = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      double volume  = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price   = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double comm    = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      double swap    = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double profit  = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      datetime time  = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      string symbol  = HistoryDealGetString(ticket, DEAL_SYMBOL);
      string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
      
      // Determine type string
      string type_str = "balance";
      if(type == DEAL_TYPE_BUY)       type_str = "buy";
      else if(type == DEAL_TYPE_SELL) type_str = "sell";
      else if(type == DEAL_TYPE_CREDIT) type_str = "credit";
      
      // Determine entry string
      string entry_str = "in";
      if(entry == DEAL_ENTRY_OUT)      entry_str = "out";
      else if(entry == DEAL_ENTRY_INOUT) entry_str = "inout";
      
      // Save last ticket as cursor
      if(ticket > last_synced_ticket)
      {
         last_synced_ticket = ticket;
      }
      
      string deal_json = StringFormat(
         "{\"ticket\":\"%I64u\",\"order_ticket\":\"%I64u\",\"position_ticket\":\"%I64u\",\"symbol\":\"%s\",\"volume\":%.2f,\"type\":\"%s\",\"entry_type\":\"%s\",\"price\":%.5f,\"commission\":%.2f,\"swap\":%.2f,\"profit\":%.2f,\"magic\":%I64d,\"comment\":\"%s\",\"execution_time\":\"%s\"}",
         ticket, order, position, CleanString(symbol), volume, type_str, entry_str, price, comm, swap, profit, magic, CleanString(comment), TimeToISO(time)
      );
      
      if(deals_json == "") deals_json = deal_json;
      else deals_json = deals_json + "," + deal_json;
   }
   
   string broker  = CleanString(AccountInfoString(ACCOUNT_COMPANY));
   string server  = CleanString(AccountInfoString(ACCOUNT_SERVER));
   string name    = CleanString(AccountInfoString(ACCOUNT_NAME));
   string num     = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   
   string payload = StringFormat(
      "{\"account_number\":\"%s\",\"broker_name\":\"%s\",\"server_name\":\"%s\",\"account_name\":\"%s\",\"currency\":\"%s\",\"leverage\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"deals\":[%s]}",
      num, broker, server, name, AccountInfoString(ACCOUNT_CURRENCY), AccountInfoInteger(ACCOUNT_LEVERAGE), balance, equity, deals_json
   );
   
   bool success = SendPostRequest("/v1/ingest/mt5/publisher/bootstrap", payload);
   if(success)
   {
      if(InpVerboseLogging) Print("Jornaltrade: Bootstrap completed successfully. Last Ticket: ", last_synced_ticket);
      
      // Save state to Global Variables
      GlobalVariableSet(g_gv_bootstrapped_name, 1.0);
      GlobalVariableSet(g_gv_last_ticket_name, (double)last_synced_ticket);
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Core Action: Send Snapshot (Open Positions and Balance)           |
//+------------------------------------------------------------------+
void SendSnapshot()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double profit  = AccountInfoDouble(ACCOUNT_PROFIT);
   
   string positions_json = "";
   int total_positions = PositionsTotal();
   
   for(int i = 0; i < total_positions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      string symbol  = PositionGetString(POSITION_SYMBOL);
      double volume  = PositionGetDouble(POSITION_VOLUME);
      double open_pr = PositionGetDouble(POSITION_PRICE_OPEN);
      double curr_pr = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl      = PositionGetDouble(POSITION_SL);
      double tp      = PositionGetDouble(POSITION_TP);
      double swap    = PositionGetDouble(POSITION_SWAP);
      double comm    = 0.0; // MT5 positions usually calculate commissions inside deals
      double prof    = PositionGetDouble(POSITION_PROFIT);
      long magic     = PositionGetInteger(POSITION_MAGIC);
      long type      = PositionGetInteger(POSITION_TYPE);
      datetime time  = (datetime)PositionGetInteger(POSITION_TIME);
      string comment = PositionGetString(POSITION_COMMENT);
      
      string type_str = (type == POSITION_TYPE_BUY) ? "buy" : "sell";
      
      string pos_json = StringFormat(
         "{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"volume\":%.2f,\"type\":\"%s\",\"price_open\":%.5f,\"price_current\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"commission\":%.2f,\"swap\":%.2f,\"profit\":%.2f,\"magic\":%I64d,\"comment\":\"%s\",\"opened_time\":\"%s\"}",
         ticket, CleanString(symbol), volume, type_str, open_pr, curr_pr, sl, tp, comm, swap, prof, magic, CleanString(comment), TimeToISO(time)
      );
      
      if(positions_json == "") positions_json = pos_json;
      else positions_json = positions_json + "," + pos_json;
   }
   
   string payload = StringFormat(
      "{\"balance\":%.2f,\"equity\":%.2f,\"profit\":%.2f,\"positions\":[%s]}",
      balance, equity, profit, positions_json
   );
   
   SendPostRequest("/v1/ingest/mt5/publisher/snapshot", payload);
   g_last_snapshot_time = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Core Action: Sync New Deals Incrementally                       |
//+------------------------------------------------------------------+
void SyncIncrementalDeals()
{
   ulong last_synced = 0;
   if(GlobalVariableCheck(g_gv_last_ticket_name))
   {
      last_synced = (ulong)GlobalVariableGet(g_gv_last_ticket_name);
   }
   
   // Select history from 2 days ago up to now to ensure no deals are missed
   datetime start_time = TimeCurrent() - 2*24*3600;
   if(!HistorySelect(start_time, TimeCurrent())) return;
   
   int total_deals = HistoryDealsTotal();
   string deals_json = "";
   ulong max_ticket = last_synced;
   int pending_deals_count = 0;
   
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= last_synced) continue;
      
      long type      = HistoryDealGetInteger(ticket, DEAL_TYPE);
      long entry     = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      long magic     = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      long order     = HistoryDealGetInteger(ticket, DEAL_ORDER);
      long position  = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      double volume  = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double price   = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double comm    = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      double swap    = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double profit  = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      datetime time  = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      string symbol  = HistoryDealGetString(ticket, DEAL_SYMBOL);
      string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
      
      string type_str = "balance";
      if(type == DEAL_TYPE_BUY)       type_str = "buy";
      else if(type == DEAL_TYPE_SELL) type_str = "sell";
      else if(type == DEAL_TYPE_CREDIT) type_str = "credit";
      
      string entry_str = "in";
      if(entry == DEAL_ENTRY_OUT)      entry_str = "out";
      else if(entry == DEAL_ENTRY_INOUT) entry_str = "inout";
      
      if(ticket > max_ticket)
      {
         max_ticket = ticket;
      }
      
      string deal_json = StringFormat(
         "{\"ticket\":\"%I64u\",\"order_ticket\":\"%I64u\",\"position_ticket\":\"%I64u\",\"symbol\":\"%s\",\"volume\":%.2f,\"type\":\"%s\",\"entry_type\":\"%s\",\"price\":%.5f,\"commission\":%.2f,\"swap\":%.2f,\"profit\":%.2f,\"magic\":%I64d,\"comment\":\"%s\",\"execution_time\":\"%s\"}",
         ticket, order, position, CleanString(symbol), volume, type_str, entry_str, price, comm, swap, profit, magic, CleanString(comment), TimeToISO(time)
      );
      
      if(deals_json == "") deals_json = deal_json;
      else deals_json = deals_json + "," + deal_json;
      
      pending_deals_count++;
   }
   
   if(pending_deals_count == 0) return;
   
   if(InpVerboseLogging) Print("Jornaltrade: Synching ", pending_deals_count, " new incremental deals...");
   string payload = StringFormat("{\"deals\":[%s]}", deals_json);
   
   if(SendPostRequest("/v1/ingest/mt5/publisher/deals", payload))
   {
      GlobalVariableSet(g_gv_last_ticket_name, (double)max_ticket);
      if(InpVerboseLogging) Print("Jornaltrade: Sync successful. New cursor: ", max_ticket);
   }
}

//+------------------------------------------------------------------+
//| Core Action: Send Heartbeat                                      |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   SendPostRequest("/v1/ingest/mt5/publisher/heartbeat", "{}");
   g_last_heartbeat_time = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   g_account_id_str = IntegerToString(login);
   g_gv_bootstrapped_name = "JT_Bootstrapped_" + g_account_id_str;
   g_gv_last_ticket_name = "JT_LastTicket_" + g_account_id_str;
   
   if(InpVerboseLogging) Print("Jornaltrade Publisher EA Initialized for account: ", g_account_id_str);
   
   if(InpPublisherToken == "PASTE_YOUR_TOKEN_HERE" || InpPublisherToken == "")
   {
      Print("Jornaltrade Error: Please paste a valid Publisher Token in the EA input parameters!");
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   // Initialize last run times to prevent immediate trigger on first tick
   g_last_snapshot_time = TimeCurrent();
   g_last_heartbeat_time = TimeCurrent();
   
   // Set Timer for events checking (every 1 second)
   EventSetTimer(1);
   
   // Perform initial verification check
   bool is_bootstrapped = false;
   if(GlobalVariableCheck(g_gv_bootstrapped_name) && GlobalVariableGet(g_gv_bootstrapped_name) == 1.0)
   {
      is_bootstrapped = true;
   }
   
   if(!is_bootstrapped)
   {
      if(BootstrapHistory())
      {
         if(InpVerboseLogging) Print("Jornaltrade: History bootstrapped on initialization.");
         SendSnapshot();
      }
      else
      {
         Print("Jornaltrade Warning: Bootstrap failed. Will retry on next timer tick.");
      }
   }
   else
   {
      if(InpVerboseLogging) Print("Jornaltrade: Account already bootstrapped. Performing initial sync.");
      SyncIncrementalDeals();
      SendSnapshot();
   }
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(InpVerboseLogging) Print("Jornaltrade Publisher EA Deinitialized.");
}

//+------------------------------------------------------------------+
//| Expert timer function                                            |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();
   
   // 1. If not bootstrapped yet, keep retrying bootstrap
   bool is_bootstrapped = false;
   if(GlobalVariableCheck(g_gv_bootstrapped_name) && GlobalVariableGet(g_gv_bootstrapped_name) == 1.0)
   {
      is_bootstrapped = true;
   }
   
   if(!is_bootstrapped)
   {
      static datetime last_bootstrap_retry = 0;
      if(now - last_bootstrap_retry >= 30) // retry every 30 seconds
      {
         last_bootstrap_retry = now;
         if(BootstrapHistory())
         {
            SendSnapshot();
         }
      }
      return;
   }
   
   // 2. Incremental Sync of new deals (e.g. check for new deals and trigger sync)
   static datetime last_deal_check = 0;
   if(now - last_deal_check >= 5) // check every 5 seconds
   {
      last_deal_check = now;
      SyncIncrementalDeals();
   }
   
   // 3. Snapshot upload
   if(now - g_last_snapshot_time >= InpSyncInterval)
   {
      SendSnapshot();
   }
   
   // 4. Heartbeat upload
   if(now - g_last_heartbeat_time >= InpHeartbeatInterval)
   {
      SendHeartbeat();
   }
}

//+------------------------------------------------------------------+
//| Expert trade transaction function                                |
//| Triggers when any transaction occurs on trade account.            |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // Check if a deal was added to the history
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      if(InpVerboseLogging) Print("Jornaltrade: Trade transaction detected, triggering incremental deal sync...");
      SyncIncrementalDeals();
      SendSnapshot();
      ProcessDiscordNotify(trans.deal);
   }
}
//+------------------------------------------------------------------+
