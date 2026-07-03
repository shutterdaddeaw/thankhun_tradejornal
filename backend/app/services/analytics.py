from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
import requests

from app.models.models import TradingAccount, Deal, DailyEquitySnapshot, PositionOpen, ShareLink, User, BalanceOperation
from app.schemas.schemas import DashboardStats, EquityCurvePoint, CalendarPnlDay

class AnalyticsService:
    @staticmethod
    def calculate_dashboard_stats(db: Session, account: TradingAccount) -> DashboardStats:
        # 1. Closed Deals (completed trades are represented by deal type buy/sell where entry_type is 'out')
        # MT5 'entry_type' of 'out' means closing a position.
        closed_deals = db.query(Deal).filter(
            Deal.account_id == account.id,
            Deal.type.in_(["buy", "sell"]),
            Deal.entry_type == "out"
        ).all()
        
        total_trades = len(closed_deals)
        winning_trades = 0
        gross_profit = 0.0
        gross_loss = 0.0
        total_closed_profit = 0.0
        
        for deal in closed_deals:
            # Net profit includes swap and commission
            net_profit = deal.profit + deal.swap + deal.commission
            total_closed_profit += net_profit
            
            if net_profit > 0:
                winning_trades += 1
                gross_profit += net_profit
            else:
                gross_loss += abs(net_profit)
                
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)
        
        # Calculate Drawdown from full reconstructed equity curve, adjusting for deposits/withdrawals
        curve = AnalyticsService.get_equity_curve(db, account.id)
        max_drawdown_pct = 0.0
        if curve:
            peak = -1.0
            cumulative_adjustment = 0.0
            for pt in curve:
                if pt.transaction_type == "deposit":
                    cumulative_adjustment += pt.transaction_amount
                elif pt.transaction_type == "withdrawal":
                    cumulative_adjustment -= pt.transaction_amount
                
                eq_adjusted = pt.equity - cumulative_adjustment
                if eq_adjusted > peak:
                    peak = eq_adjusted
                
                actual_peak_at_time = peak + cumulative_adjustment
                if actual_peak_at_time > 0:
                    dd = (peak - eq_adjusted) / actual_peak_at_time * 100
                    if dd > max_drawdown_pct:
                        max_drawdown_pct = dd

        return DashboardStats(
            balance=account.balance,
            equity=account.equity,
            floating_profit=account.profit,
            total_profit=total_closed_profit,
            win_rate=round(win_rate, 2),
            profit_factor=round(profit_factor, 2),
            total_trades=total_trades,
            drawdown_pct=round(max_drawdown_pct, 2),
            currency=account.currency,
            account_name=account.account_name,
            broker_name=account.broker_name,
            status=account.status,
            connection_type=account.connection_type
        )

    @staticmethod
    def get_equity_curve(db: Session, account_id: int) -> List[EquityCurvePoint]:
        # 1. Fetch all DailyEquitySnapshots
        snapshots = db.query(DailyEquitySnapshot).filter(
            DailyEquitySnapshot.account_id == account_id
        ).order_by(DailyEquitySnapshot.date).all()
        
        snap_map = {snap.date: snap for snap in snapshots}
        
        # Query balance operations to map date -> net transaction amount
        ops = db.query(BalanceOperation).filter(BalanceOperation.account_id == account_id).all()
        daily_ops = {}
        for op in ops:
            op_date = op.timestamp.date()
            if op_date not in daily_ops:
                daily_ops[op_date] = 0.0
            daily_ops[op_date] += op.amount

        # 2. Fetch all deals to reconstruct prior history
        deals = db.query(Deal).filter(
            Deal.account_id == account_id
        ).order_by(Deal.execution_time).all()
        
        curve = []
        
        if not deals:
            # Fallback if no deals and no snapshots
            if not snapshots:
                if account:
                    curve.append(
                        EquityCurvePoint(
                            date=datetime.utcnow().date(),
                            balance=account.balance,
                            equity=account.equity,
                            floating_profit=account.profit,
                            transaction_type=None,
                            transaction_amount=None
                        )
                    )
                return curve
            
            # If snapshots exist but no deals
            for snap in snapshots:
                tx_type = None
                tx_amt = None
                if snap.date in daily_ops:
                    net_tx = daily_ops[snap.date]
                    if net_tx > 0:
                        tx_type = "deposit"
                        tx_amt = net_tx
                    elif net_tx < 0:
                        tx_type = "withdrawal"
                        tx_amt = abs(net_tx)
                curve.append(
                    EquityCurvePoint(
                        date=snap.date,
                        balance=snap.balance,
                        equity=snap.equity,
                        floating_profit=snap.floating_profit,
                        transaction_type=tx_type,
                        transaction_amount=tx_amt
                    )
                )
            return curve
            
        # 3. Calculate running balance day by day from deals
        running_balance = 0.0
        daily_balances = {}
        
        for deal in deals:
            change = deal.profit + (deal.swap or 0.0) + (deal.commission or 0.0)
            running_balance += change
            deal_date = deal.execution_time.date()
            daily_balances[deal_date] = running_balance
            
        # Sort reconstructed dates
        deal_dates = sorted(list(daily_balances.keys()))
        first_deal_date = deal_dates[0]
        
        # We want to fill the curve from first_deal_date to today
        today = datetime.utcnow().date()
        
        # If we have snapshots, we can stop historical reconstruction on the first snapshot date
        first_snap_date = min(snap_map.keys()) if snap_map else None
        
        current_date = first_deal_date
        last_known_balance = 0.0
        
        while current_date <= today:
            tx_type = None
            tx_amt = None
            if current_date in daily_ops:
                net_tx = daily_ops[current_date]
                if net_tx > 0:
                    tx_type = "deposit"
                    tx_amt = net_tx
                elif net_tx < 0:
                    tx_type = "withdrawal"
                    tx_amt = abs(net_tx)

            # If we hit snapshots, switch to snapshot data
            if first_snap_date and current_date >= first_snap_date:
                if current_date in snap_map:
                    snap = snap_map[current_date]
                    curve.append(
                        EquityCurvePoint(
                            date=snap.date,
                            balance=snap.balance,
                            equity=snap.equity,
                            floating_profit=snap.floating_profit,
                            transaction_type=tx_type,
                            transaction_amount=tx_amt
                        )
                    )
                    last_known_balance = snap.balance
                else:
                    # Carry forward last snapshot
                    curve.append(
                        EquityCurvePoint(
                            date=current_date,
                            balance=last_known_balance,
                            equity=last_known_balance,
                            floating_profit=0.0,
                            transaction_type=tx_type,
                            transaction_amount=tx_amt
                        )
                    )
            else:
                # Reconstruct from deals
                if current_date in daily_balances:
                    last_known_balance = daily_balances[current_date]
                
                # If this date has deals, or we already have a running balance
                if last_known_balance > 0.0 or current_date in daily_balances:
                    curve.append(
                        EquityCurvePoint(
                            date=current_date,
                            balance=last_known_balance,
                            equity=last_known_balance,
                            floating_profit=0.0,
                            transaction_type=tx_type,
                            transaction_amount=tx_amt
                        )
                    )
            
            current_date += timedelta(days=1)
            
        # Ensure we always return at least something
        if not curve:
            account = db.query(TradingAccount).filter(TradingAccount.id == account_id).first()
            if account:
                curve.append(
                    EquityCurvePoint(
                        date=today,
                        balance=account.balance,
                        equity=account.equity,
                        floating_profit=account.profit
                    )
                )
                
        return curve

    @staticmethod
    def get_calendar_pnl(db: Session, account_id: int) -> List[CalendarPnlDay]:
        # Group closed deals by execution date
        # PostgreSQL supports func.date(Deal.execution_time), SQLite can use func.date(Deal.execution_time) too!
        closed_deals = db.query(
            func.date(Deal.execution_time).label("deal_date"),
            func.sum(Deal.profit + Deal.swap + Deal.commission).label("daily_profit"),
            func.count(Deal.id).label("trades_count")
        ).filter(
            Deal.account_id == account_id,
            Deal.type.in_(["buy", "sell"]),
            Deal.entry_type == "out"
        ).group_by(
            func.date(Deal.execution_time)
        ).order_by(
            "deal_date"
        ).all()
        
        calendar_days = []
        for day in closed_deals:
            # handle date parsing since SQLite returns string for func.date
            d_val = day.deal_date
            if isinstance(d_val, str):
                d_val = date.fromisoformat(d_val)
            
            calendar_days.append(
                CalendarPnlDay(
                    date=d_val,
                    profit=round(day.daily_profit, 2),
                    trades_count=day.trades_count
                )
            )
            
        return calendar_days

    @staticmethod
    def generate_ai_summary(db: Session, account_id: int) -> str:
        # Fetch account and user (for AI settings)
        account = db.query(TradingAccount).filter(TradingAccount.id == account_id).first()
        if not account:
            return "Account not found."
            
        user = db.query(User).filter(User.id == account.user_id).first()
        
        # Identify cent accounts
        cent_currency_tags = ["usc", "usdc", "eurc", "gbpc", "cent", "uscent"]
        def is_cent(curr):
            return curr.lower() in cent_currency_tags if curr else False
            
        # Gather all deals for this account to compute detailed metrics
        all_deals = db.query(Deal).filter(
            Deal.account_id == account_id
        ).order_by(Deal.execution_time).all()
        
        closed_deals = [d for d in all_deals if d.type in ["buy", "sell"] and d.entry_type == "out"]
        
        if not closed_deals:
            return (
                f"### AI Analysis for {account.account_name}\n\n"
                "ระบบยังต้องการข้อมูลประวัติการเทรดเพิ่มเติมเพื่อเริ่มวิเคราะห์พฤติกรรม "
                "กรุณารันโปรแกรม MT5 พร้อมกับติดตั้ง Publisher EA หรือทำการเปิดออเดอร์เพื่อซิงค์ข้อมูลเพิ่มเติม"
            )
            
        # Compute stats
        total_trades = len(closed_deals)
        winning_trades = len([d for d in closed_deals if (d.profit + d.swap + d.commission) >= 0])
        losing_trades = total_trades - winning_trades
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        
        # Buy / Sell Win Rates
        buy_trades = [d for d in closed_deals if d.type == "buy"]
        buy_wins = len([d for d in buy_trades if (d.profit + d.swap + d.commission) >= 0])
        buy_win_rate = (buy_wins / len(buy_trades) * 100) if buy_trades else 0.0
        
        sell_trades = [d for d in closed_deals if d.type == "sell"]
        sell_wins = len([d for d in sell_trades if (d.profit + d.swap + d.commission) >= 0])
        sell_win_rate = (sell_wins / len(sell_trades) * 100) if sell_trades else 0.0
        
        # Profits
        net_profit = sum(d.profit + d.swap + d.commission for d in closed_deals)
        gross_profit = sum(d.profit + d.swap + d.commission for d in closed_deals if (d.profit + d.swap + d.commission) > 0)
        gross_loss = sum(d.profit + d.swap + d.commission for d in closed_deals if (d.profit + d.swap + d.commission) < 0)
        profit_factor = (gross_profit / abs(gross_loss)) if gross_loss != 0 else (gross_profit if gross_profit > 0 else 1.0)
        
        # Averages
        avg_win = (gross_profit / winning_trades) if winning_trades > 0 else 0.0
        avg_loss = (abs(gross_loss) / losing_trades) if losing_trades > 0 else 0.0
        risk_reward = (avg_win / avg_loss) if avg_loss != 0 else 0.0
        expectancy = net_profit / total_trades if total_trades > 0 else 0.0
        
        # Best / Worst
        trade_profits = [d.profit + d.swap + d.commission for d in closed_deals]
        best_trade = max(trade_profits) if trade_profits else 0.0
        worst_trade = min(trade_profits) if trade_profits else 0.0
        
        # Starting Balance
        starting_balance = account.balance - net_profit
        return_pct = (net_profit / starting_balance * 100) if starting_balance > 0 else 0.0
        
        # TP / SL hits & Manual Closes
        tp_hits = 0
        sl_hits = 0
        manual_closes = 0
        for d in closed_deals:
            net = d.profit + d.swap + d.commission
            comment_lower = (d.comment or "").lower()
            if net >= 0:
                tp_hits += 1
            else:
                if "sl" in comment_lower or "[sl]" in comment_lower:
                    sl_hits += 1
                else:
                    manual_closes += 1
        
        tp_pct = (tp_hits / total_trades * 100) if total_trades > 0 else 0.0
        sl_pct = (sl_hits / total_trades * 100) if total_trades > 0 else 0.0
        manual_pct = (manual_closes / total_trades * 100) if total_trades > 0 else 0.0
        
        # Max Drawdown from full reconstructed curve, adjusting for deposits/withdrawals
        curve = AnalyticsService.get_equity_curve(db, account_id)
        max_dd_pct = 0.0
        if curve:
            peak = -1.0
            cumulative_adjustment = 0.0
            for pt in curve:
                if pt.transaction_type == "deposit":
                    cumulative_adjustment += pt.transaction_amount
                elif pt.transaction_type == "withdrawal":
                    cumulative_adjustment -= pt.transaction_amount
                
                eq_adjusted = pt.equity - cumulative_adjustment
                if eq_adjusted > peak:
                    peak = eq_adjusted
                
                actual_peak_at_time = peak + cumulative_adjustment
                if actual_peak_at_time > 0:
                    dd = (peak - eq_adjusted) / actual_peak_at_time * 100
                    if dd > max_dd_pct:
                        max_dd_pct = dd
            
        recovery_factor = (net_profit / (starting_balance * (max_dd_pct / 100))) if (starting_balance > 0 and max_dd_pct > 0) else (net_profit / abs(worst_trade) if worst_trade != 0 else 1.0)

        # Recent 15 deals summary string
        deals_summary_str = ""
        for i, d in enumerate(closed_deals[-15:]):
            net = d.profit + d.swap + d.commission
            deals_summary_str += f"- Ticket {d.ticket}: {d.type.upper()} {d.volume} lots {d.symbol} -> Net: {net:.2f} {account.currency} | Comment: {d.comment or '-'}\n"
            
        # Open positions summary
        open_pos = db.query(PositionOpen).filter(PositionOpen.account_id == account_id).all()
        positions_summary_str = ""
        for p in open_pos:
            positions_summary_str += f"- {p.type.upper()} {p.volume} lots {p.symbol} | Open Price: {p.price_open:.5f} -> Floating: {p.profit:.2f} {account.currency}\n"
        if not open_pos:
            positions_summary_str = "- ไม่มีออเดอร์ถือครองในขณะนี้\n"
            
        # Check if AI provider settings are saved and not mock
        provider = user.ai_provider if user else "mock"
        api_key = user.ai_api_key if user else None
        
        if not provider or provider == "mock" or not api_key:
            # Rule-based fallback summary
            favorite_symbol = max(set([d.symbol for d in closed_deals if d.symbol]), default="N/A")
            report = (
                f"### 🤖 บทวิเคราะห์พฤติกรรมการเทรด (สถิติวิเคราะห์เบื้องต้น)\n\n"
                f"*(หมายเหตุ: คุณยังไม่ได้ตั้งค่าคีย์ AI ตัวจริง หรือตั้งค่าไว้เป็นแบบทดลอง ระบบจึงใช้ Rule-based ดึงรายงานดิบมาประเมิน)*\n\n"
                f"จากการประเมินพอร์ต **{account.account_name}** เบื้องต้น:\n\n"
                f"- **สินทรัพย์ที่เทรดบ่อยที่สุด:** `{favorite_symbol}`\n"
                f"- **พฤติกรรมการจบออเดอร์:** ชน TP {tp_hits} ครั้ง ({tp_pct:.1f}%), ชน SL {sl_hits} ครั้ง ({sl_pct:.1f}%), และปิดด้วยมือ {manual_closes} ครั้ง ({manual_pct:.1f}%)\n"
                f"- **ประเมินความสัมพันธ์ความเสี่ยง (R:R):** ปัจจุบันอยู่ที่ `{risk_reward:.2f}x` และมี Profit Factor เท่ากับ `{profit_factor:.2f}`\n\n"
                f"👉 *แนะนำให้ไปที่ตั้งค่าการสรุป AI บนหน้าเว็บบอร์ดเพื่อเชื่อมต่อ Gemini หรือ API คีย์ตัวจริง เพื่อเปิดใช้ระบบเขียนบทจิตวิทยาเทรดวิเคราะห์เชิงลึกเต็มรูปแบบ*"
            )
            return report

        # Setup prompt
        prompt = f"""
คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์พฤติกรรมการเทรด (Trading Behavior Analyst) และนักจิตวิทยาการเทรดมืออาชีพ
กรุณาทำหน้าที่วิเคราะห์สถิติพอร์ตการเทรดนี้ และเขียนรายงานสรุปเชิงลึกเป็นภาษาไทย ในรูปแบบ Markdown

### ข้อมูลสถิติของพอร์ตการเทรด:
- ชื่อบัญชี: {account.account_name}
- โบรกเกอร์: {account.broker_name}
- ยอดบาลานซ์ปัจจุบัน: {account.balance:.2f} {account.currency}
- มูลค่าเอควิตี้ปัจจุบัน: {account.equity:.2f} {account.currency}
- กำไรสะสมสุทธิ (Net Profit): {net_profit:.2f} {account.currency} (คิดเป็นผลตอบแทน {return_pct:.2f}% จากเงินเริ่มต้น {starting_balance:.2f} {account.currency})
- จำนวนดีลทั้งหมด: {total_trades} (ชนะ {winning_trades} / แพ้ {losing_trades})
- อัตราการชนะ (Win Rate): {win_rate:.1f}% (Buy Win Rate: {buy_win_rate:.1f}%, Sell Win Rate: {sell_win_rate:.1f}%)
- Profit Factor: {profit_factor:.2f} (Gross Win: {gross_profit:.2f} / Gross Loss: {gross_loss:.2f})
- Trade Expectancy (คาดหวังเฉลี่ยต่อดีล): {expectancy:.2f} {account.currency}
- ค่าเฉลี่ยดีลที่ชนะ (Avg Win): {avg_win:.2f} {account.currency}
- ค่าเฉลี่ยดีลที่แพ้ (Avg Loss): {avg_loss:.2f} {account.currency}
- Risk:Reward Ratio: {risk_reward:.2f}x
- ดีลที่ดีที่สุด (Best Trade): {best_trade:.2f} {account.currency}
- ดีลที่แย่ที่สุด (Worst Trade): {worst_trade:.2f} {account.currency}
- สถิติจบออเดอร์: ชน TP {tp_hits} ครั้ง ({tp_pct:.1f}%), ชน SL {sl_hits} ครั้ง ({sl_pct:.1f}%), ปิดมือ {manual_closes} ครั้ง ({manual_pct:.1f}%)
- Recovery Factor: {recovery_factor:.2f}

### ดีลล่าสุด 15 รายการ (Recent Closed Deals):
{deals_summary_str}

### ออเดอร์ที่ยังถือครองอยู่ (Live Open Positions):
{positions_summary_str}

กรุณาเขียนรายงานวิเคราะห์หัวข้อดังต่อไปนี้เป็นภาษาไทย:
1. **การประเมินภาพรวมพฤติกรรมการเทรด (Performance Assessment)** - วิเคราะห์จุดเด่นจุดด้อยจากสถิติ (เช่น Profit Factor, Win Rate, Risk:Reward)
2. **การควบคุมความเสี่ยงและการชนเป้าหมาย (Risk Control & Execution)** - วิเคราะห์พฤติกรรมการตั้ง SL/TP เทียบกับการปิดมือ และผลกระทบต่อพอร์ต
3. **คำแนะนำเชิงจิตวิทยาและเทคนิคปรับปรุง (Psychological & Tactical Recommendations)** - ให้คำแนะนำที่จับต้องได้ 3 ข้อเพื่อเพิ่มประสิทธิภาพของพอร์ตนี้

เขียนในโทนมืออาชีพ สร้างสรรค์ ให้กำลังใจ และกระชับ ไม่ต้องเกริ่นทักทาย เริ่มต้นด้วยหัวข้อ Markdown ทันที
"""

        try:
            # Request to selected provider
            model = user.ai_model or ""
            base_url = user.ai_base_url or ""
            
            if provider == "gemini":
                # Google Gemini API
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'gemini-1.5-flash'}:generateContent?key={api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}]
                }
                res = requests.post(url, json=payload, headers=headers, timeout=120)
                res.raise_for_status()
                res_data = res.json()
                return res_data["candidates"][0]["content"]["parts"][0]["text"]
                
            else:
                # OpenAI compatible endpoint (OpenRouter, Nvidia, OpenAI, custom base url)
                if provider == "openrouter":
                    url = base_url or "https://openrouter.ai/api/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer": "https://jornaltrade.local",
                        "X-Title": "Jornaltrade App",
                        "Content-Type": "application/json"
                    }
                    payload_model = model or "google/gemma-2-9b-it:free"
                elif provider == "nvidia":
                    url = base_url or "https://integrate.api.nvidia.com/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload_model = model or "nvidia/llama-3.1-nemotron-70b-instruct"
                elif provider == "openai":
                    url = base_url or "https://api.openai.com/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload_model = model or "gpt-4o-mini"
                else:
                    # Custom / Other
                    url = base_url
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload_model = model

                if not url:
                    raise ValueError("API Base URL is required for custom/other provider")

                payload = {
                    "model": payload_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
                
                res = requests.post(url, json=payload, headers=headers, timeout=120)
                res.raise_for_status()
                res_data = res.json()
                return res_data["choices"][0]["message"]["content"]
                
        except Exception as e:
            return f"### ❌ เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI ({provider})\n\nรายละเอียด: {str(e)}\n\nกรุณาตรวจสอบว่า API Key และสิทธิ์การใช้งานของคุณถูกต้องเรียบร้อยในหน้าตั้งค่า"

    @staticmethod
    def generate_combined_ai_summary(db: Session, user_id: int) -> str:
        accounts = db.query(TradingAccount).filter(TradingAccount.user_id == user_id).all()
        if not accounts:
            return "No accounts found."
            
        user = db.query(User).filter(User.id == user_id).first()
        
        # Aggregate stats
        total_balance = 0.0
        total_equity = 0.0
        all_closed_deals = []
        
        # Identify cent accounts
        cent_currency_tags = ["usc", "usdc", "eurc", "gbpc", "cent", "uscent"]
        def is_cent(curr):
            return curr.lower() in cent_currency_tags if curr else False

        for acc in accounts:
            bal = acc.balance
            eq = acc.equity
            
            # Fetch deals
            deals = db.query(Deal).filter(
                Deal.account_id == acc.id,
                Deal.type.in_(["buy", "sell"]),
                Deal.entry_type == "out"
            ).all()
            
            is_acc_cent = is_cent(acc.currency)
            if is_acc_cent:
                bal /= 100.0
                eq /= 100.0
                
            total_balance += bal
            total_equity += eq
            
            for d in deals:
                factor = 100.0 if is_acc_cent else 1.0
                all_closed_deals.append({
                    "type": d.type,
                    "profit": (d.profit or 0.0) / factor,
                    "swap": (d.swap or 0.0) / factor,
                    "commission": (d.commission or 0.0) / factor,
                    "comment": d.comment
                })
            
        if not all_closed_deals:
            return "ไม่พบข้อมูลประวัติการเทรดในการคำนวณสรุปรวมพอร์ต"
            
        # Calculate stats
        total_trades = len(all_closed_deals)
        winning_trades = len([d for d in all_closed_deals if (d["profit"] + d["swap"] + d["commission"]) >= 0])
        losing_trades = total_trades - winning_trades
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        
        buy_trades = [d for d in all_closed_deals if d["type"] == "buy"]
        buy_wins = len([d for d in buy_trades if (d["profit"] + d["swap"] + d["commission"]) >= 0])
        buy_win_rate = (buy_wins / len(buy_trades) * 100) if buy_trades else 0.0
        
        sell_trades = [d for d in all_closed_deals if d["type"] == "sell"]
        sell_wins = len([d for d in sell_trades if (d["profit"] + d["swap"] + d["commission"]) >= 0])
        sell_win_rate = (sell_wins / len(sell_trades) * 100) if sell_trades else 0.0
        
        net_profit = sum(d["profit"] + d["swap"] + d["commission"] for d in all_closed_deals)
        gross_profit = sum(d["profit"] + d["swap"] + d["commission"] for d in all_closed_deals if (d["profit"] + d["swap"] + d["commission"]) > 0)
        gross_loss = sum(d["profit"] + d["swap"] + d["commission"] for d in all_closed_deals if (d["profit"] + d["swap"] + d["commission"]) < 0)
        profit_factor = (gross_profit / abs(gross_loss)) if gross_loss != 0 else (gross_profit if gross_profit > 0 else 1.0)
        
        avg_win = (gross_profit / winning_trades) if winning_trades > 0 else 0.0
        avg_loss = (abs(gross_loss) / losing_trades) if losing_trades > 0 else 0.0
        risk_reward = (avg_win / avg_loss) if avg_loss != 0 else 0.0
        expectancy = net_profit / total_trades if total_trades > 0 else 0.0
        
        trade_profits = [d["profit"] + d["swap"] + d["commission"] for d in all_closed_deals]
        best_trade = max(trade_profits) if trade_profits else 0.0
        worst_trade = min(trade_profits) if trade_profits else 0.0
        
        tp_hits = 0
        sl_hits = 0
        manual_closes = 0
        for d in all_closed_deals:
            net = d["profit"] + d["swap"] + d["commission"]
            comment_lower = (d["comment"] or "").lower()
            if net >= 0:
                tp_hits += 1
            else:
                if "sl" in comment_lower or "[sl]" in comment_lower:
                    sl_hits += 1
                else:
                    manual_closes += 1

        recovery_factor = net_profit / abs(worst_trade) if worst_trade != 0 else 1.0
        
        # Setup prompt
        prompt = f"""
คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์พฤติกรรมการเทรด (Trading Behavior Analyst) และนักจิตวิทยาการเทรดมืออาชีพ
กรุณาทำหน้าที่วิเคราะห์สถิติภาพรวมพอร์ตรวมของลูกค้า (Combined Portfolio Analysis) และเขียนรายงานสรุปเชิงลึกเป็นภาษาไทย ในรูปแบบ Markdown

### ข้อมูลสถิติของพอร์ตรวมทุกพอร์ต:
- จำนวนพอร์ตทั้งหมดที่เชื่อมต่อ: {len(accounts)} พอร์ต
- ยอดบาลานซ์รวมทั้งหมด: {total_balance:.2f} USD (แปลงค่าจากเซนต์แล้ว)
- มูลค่าเอควิตี้รวมทั้งหมด: {total_equity:.2f} USD
- กำไรสะสมสุทธิรวม (Net Profit): {net_profit:.2f} USD
- จำนวนดีลรวมทั้งหมด: {total_trades} (ชนะ {winning_trades} / แพ้ {losing_trades})
- อัตราการชนะรวม (Win Rate): {win_rate:.1f}% (Buy Win Rate: {buy_win_rate:.1f}%, Sell Win Rate: {sell_win_rate:.1f}%)
- Profit Factor รวม: {profit_factor:.2f} (Gross Win: {gross_profit:.2f} / Gross Loss: {gross_loss:.2f})
- Trade Expectancy (คาดหวังเฉลี่ยต่อดีล): {expectancy:.2f} USD
- ค่าเฉลี่ยดีลที่ชนะ (Avg Win): {avg_win:.2f} USD
- ค่าเฉลี่ยดีลที่แพ้ (Avg Loss): {avg_loss:.2f} USD
- Risk:Reward Ratio: {risk_reward:.2f}x
- ดีลที่ดีที่สุด (Best Trade): {best_trade:.2f} USD
- ดีลที่แย่ที่สุด (Worst Trade): {worst_trade:.2f} USD
- สถิติจบออเดอร์รวม: ชน TP {tp_hits} ครั้ง, ชน SL {sl_hits} ครั้ง, ปิดมือ {manual_closes} ครั้ง
- Recovery Factor: {recovery_factor:.2f}

กรุณาเขียนรายงานวิเคราะห์พอร์ตโฟลิโอภาพรวมในหัวข้อต่อไปนี้เป็นภาษาไทย:
1. **การประเมินการกระจายความเสี่ยงภาพรวม (Portfolio Diversification & Risk assessment)** - การใช้ EA หลายตัวหรือการเทรดหลายสัญญาสร้างประโยชน์/ความเสี่ยงในการคำนวณขนาดความเสี่ยงอย่างไร
2. **จุดเด่นจุดอ่อนของพฤติกรรมการคุมพอร์ต (Overall Performance & Weaknesses)** - มีพฤติกรรมเทรดตรงไหนที่เป็นจุดเด่น หรือเป็นรูรั่วของระบบ
3. **คำแนะนำสำหรับการควบคุมพอร์ตระยะยาว (Strategic Long-term Actionable Tips)** - ให้คำแนะนำที่ชัดเจน 3 ข้อ

เขียนในโทนมืออาชีพ สร้างสรรค์ และกระชับ ไม่ต้องเกริ่นทักทาย เริ่มต้นด้วยหัวข้อ Markdown ทันที
"""

        # API settings
        provider = user.ai_provider if user else "mock"
        api_key = user.ai_api_key if user else None
        
        if not provider or provider == "mock" or not api_key:
            return (
                f"### 🤖 บทวิเคราะห์ภาพรวมพอร์ตการลงทุน (จำลองผลลัพธ์)\n\n"
                f"*(หมายเหตุ: คุณยังไม่ได้ตั้งค่าคีย์ AI ตัวจริง หรือตั้งค่าไว้เป็นแบบทดลอง ระบบจึงใช้ Rule-based ดึงรายงานดิบมาประเมิน)*\n\n"
                f"- **พอร์ตที่เชื่อมต่อทั้งหมด:** `{len(accounts)}` บัญชี\n"
                f"- **พฤติกรรมการจบออเดอร์รวม:** ชน TP {tp_hits} ครั้ง, ชน SL {sl_hits} ครั้ง, และปิดด้วยมือ {manual_closes} ครั้ง\n"
                f"- **ผลงานรวม:** ปัจจุบันมี Profit Factor เท่ากับ `{profit_factor:.2f}` และมีอัตราส่วนความเสี่ยงเทียบคอมมิชชั่นอยู่ที่ `{risk_reward:.2f}x`\n\n"
                f"👉 *แนะนำให้ไปที่ตั้งค่าการสรุป AI บนหน้าเว็บบอร์ดเพื่อเชื่อมต่อ Gemini เพื่อวิเคราะห์แบบละเอียดเชิงกลยุทธ์ผ่าน AI ตัวจริง*"
            )

        try:
            model = user.ai_model or ""
            base_url = user.ai_base_url or ""
            
            if provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'gemini-1.5-flash'}:generateContent?key={api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {"contents": [{"parts": [{"text": prompt}]}]}
                res = requests.post(url, json=payload, headers=headers, timeout=120)
                res.raise_for_status()
                return res.json()["candidates"][0]["content"]["parts"][0]["text"]
            else:
                if provider == "openrouter":
                    url = base_url or "https://openrouter.ai/api/v1/chat/completions"
                    payload_model = model or "google/gemma-2-9b-it:free"
                elif provider == "nvidia":
                    url = base_url or "https://integrate.api.nvidia.com/v1/chat/completions"
                    payload_model = model or "nvidia/llama-3.1-nemotron-70b-instruct"
                elif provider == "openai":
                    url = base_url or "https://api.openai.com/v1/chat/completions"
                    payload_model = model or "gpt-4o-mini"
                else:
                    url = base_url
                    payload_model = model

                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": payload_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
                res = requests.post(url, json=payload, headers=headers, timeout=120)
                res.raise_for_status()
                res_data = res.json()
                return res_data["choices"][0]["message"]["content"]
                
        except Exception as e:
            return f"### ❌ เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI ({provider})\n\nรายละเอียด: {str(e)}"
