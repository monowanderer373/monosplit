import { useStore } from '../store/useStore'

export type Lang = 'en' | 'zh'

const translations = {
  // ── Bottom Tabs ──
  'tab.summary': { en: 'SUMMARY', zh: '摘要' },
  'tab.settle': { en: 'SETTLE UP', zh: '结算' },
  'tab.profile': { en: 'PROFILE', zh: '设置' },
  'tab.addExpense': { en: 'Add expense', zh: '添加支出' },

  // ── Groups Page ──
  'app.title': { en: 'TabbyTally', zh: 'TabbyTally' },
  'app.subtitle': {
    en: 'Split travel costs with friends, then settle everything in one clear statement.',
    zh: '和朋友一起分摊旅行花费，最后用一份清楚账单完成结算。',
  },
  'app.loading': { en: 'Loading...', zh: '加载中...' },
  'app.opening': { en: 'Opening Tabby Tally…', zh: '正在打开 Tabby Tally…' },
  'app.errorLabel': { en: 'Safe recovery', zh: '安全恢复' },
  'app.errorTitle': { en: 'Tabby Tally could not finish opening.', zh: 'Tabby Tally 暂时无法完成打开。' },
  'app.errorHelp': {
    en: 'Your financial details were not included in the error report. Retry, or reload the app if the problem continues.',
    zh: '错误报告不包含你的财务资料。请重试；若问题持续，可重新加载应用。',
  },
  'app.reload': { en: 'Reload app', zh: '重新加载应用' },
  // ── Expense Form ──
  'expense.addTitle': { en: 'Add Expense', zh: '添加支出' },
  'expense.editTitle': { en: 'Edit Expense', zh: '编辑支出' },
  'expense.save': { en: 'Save Expense', zh: '保存支出' },
  'expense.saveChanges': { en: 'Save Changes', zh: '保存更改' },
  'expense.remove': { en: 'Remove Expense', zh: '删除支出' },
  'expense.mobileQuick': { en: 'Mobile quick mode', zh: '手机快捷模式' },
  'expense.description': { en: 'Description', zh: '描述' },
  'expense.amount': { en: 'Amount', zh: '金额' },
  'expense.currency': { en: 'Currency', zh: '货币' },
  'expense.category': { en: 'Category', zh: '分类' },
  'expense.date': { en: 'Date', zh: '日期' },
  'expense.manualRate': { en: 'Manual rate', zh: '手动汇率' },
  'expense.optional': { en: 'Optional', zh: '选填' },
  'expense.autoRate': { en: 'Auto rate', zh: '自动汇率' },
  'expense.fetchRate': { en: 'Fetch rate', zh: '获取汇率' },
  'expense.loading': { en: 'Loading...', zh: '加载中...' },
  'expense.paidBy': { en: 'Paid by', zh: '付款人' },
  'expense.equal': { en: 'Equal', zh: '均分' },
  'expense.itemized': { en: 'Itemized', zh: '逐项' },
  'expense.splitBetween': { en: 'Split between', zh: '分摊人' },
  'expense.selectAll': { en: 'Select all', zh: '全选' },
  'expense.clear': { en: 'Clear', zh: '清除' },
  'expense.cancel': { en: 'Cancel', zh: '取消' },
  'expense.inputPretax': { en: 'Input pre-tax', zh: '输入税前金额' },
  'expense.inputTotal': { en: 'Input total', zh: '输入总金额' },
  'expense.serviceTax': { en: 'Service tax %', zh: '服务税 %' },
  'expense.salesTax': { en: 'Sales tax %', zh: '销售税 %' },
  'expense.tips': { en: 'Tips %', zh: '小费 %' },
  'expenseWizard.stepWhat': { en: 'What was this for?', zh: '这是什么费用？' },
  'expenseWizard.stepWhatHelp': { en: 'Give the bill a name people will recognize later.', zh: '给这笔账起一个大家之后看得懂的名字。' },
  'expenseWizard.stepAmount': { en: 'How much was the bill?', zh: '这笔账多少钱？' },
  'expenseWizard.stepAmountHelp': { en: 'Enter the original paid amount and currency.', zh: '输入实际付款金额和币种。' },
  'expenseWizard.stepPayer': { en: 'Who paid first?', zh: '谁先付的钱？' },
  'expenseWizard.stepPayerHelp': { en: 'Choose the friend who paid this bill. Multiple payers are supported.', zh: '选择垫付这笔账的朋友，也支持多人付款。' },
  'expenseWizard.stepSplit': { en: 'Who should share it?', zh: '这笔账要怎么分？' },
  'expenseWizard.stepSplitHelp': { en: 'Start equal for simple bills, or use exact amounts when people ordered different things.', zh: '简单账单用平均分；大家点了不同东西时用按人金额。' },
  'expenseWizard.equalTitle': { en: 'Split equally', zh: '平均分' },
  'expenseWizard.equalHelp': { en: 'Best for taxi, tickets, shared meals, and simple group costs.', zh: '适合打车、门票、共享餐费等简单团体支出。' },
  'expenseWizard.itemizedTitle': { en: 'Exact amounts', zh: '按人金额' },
  'expenseWizard.itemizedHelp': { en: 'Use this when each person should pay a different amount.', zh: '适合每个人承担金额不同的情况。' },
  'expenseWizard.stepReview': { en: 'Review and save', zh: '检查并保存' },
  'expenseWizard.stepReviewHelp': { en: 'Confirm the date and save the expense to the trip.', zh: '确认日期后保存到这趟旅程。' },
  'expense.totalTax': { en: 'Total tax', zh: '总税率' },
  'expense.filled': { en: 'Filled', zh: '已填' },
  'expense.persons': { en: 'person(s)', zh: '人' },
  'expense.preTaxBudget': { en: 'Pre-tax budget', zh: '税前预算' },
  'expense.from': { en: 'from', zh: '来自' },
  'expense.incl': { en: 'incl.', zh: '含' },
  'expense.tax': { en: 'tax', zh: '税' },
  'expense.preTaxTotal': { en: 'Pre-tax total', zh: '税前合计' },
  'expense.itemizedTotal': { en: 'Itemized total', zh: '逐项合计' },
  'expense.afterTaxTotal': { en: 'After-tax total', zh: '税后合计' },
  'expense.remaining': { en: 'Remaining', zh: '剩余' },
  'expense.exceeds': { en: 'Exceeds', zh: '超出' },
  'expense.each': { en: 'each', zh: '每人' },
  'expense.withinTrip': { en: 'Within trip period', zh: '在旅程期间内' },
  'expense.outsideTrip': { en: 'Outside trip period', zh: '旅程期间外' },
  'expense.futureDate': { en: 'Future date — auto rate unavailable', zh: '未来日期 — 无法自动获取汇率' },
  'expense.rateFrom': { en: 'rate from', zh: '汇率日期' },
  'expense.draftRestored': { en: 'Unsaved draft restored from this device.', zh: '已从此设备恢复未保存草稿。' },
  'expense.discardDraft': { en: 'Discard draft', zh: '丢弃草稿' },
  'expense.splitReceipt': { en: 'By receipt', zh: '按小票分摊' },
  'expense.receiptItem': { en: 'Item', zh: '项目' },
  'expense.receiptItemName': { en: 'Item name', zh: '项目名称' },
  'expense.receiptUntitled': { en: 'Untitled item', zh: '未命名项目' },
  'expense.receiptUnitPrice': { en: 'Unit price', zh: '单价' },
  'expense.receiptQty': { en: 'Qty', zh: '数量' },
  'expense.receiptLineTotal': { en: 'Line total', zh: '小计' },
  'expense.receiptWhoOwes': { en: 'Who owes this item', zh: '谁分摊这个项目' },
  'expense.receiptChoosePeople': { en: 'Choose people', zh: '选择分摊人' },
  'expense.receiptNoPeopleSelected': { en: 'No one selected', zh: '未选择人员' },
  'expense.receiptAddItem': { en: 'Add item', zh: '添加项目' },
  'expense.receiptRemoveItem': { en: 'Remove', zh: '删除' },
  'expense.receiptTaxAmount': { en: 'Tax amount', zh: '税额' },
  'expense.receiptNoTax': { en: 'Leave blank if there is no tax.', zh: '如果没有税，留空即可。' },
  'expense.receiptSubtotal': { en: 'Subtotal', zh: '项目合计' },
  'expense.receiptGrandTotal': { en: 'Grand total', zh: '总计' },
  'expense.receiptAutoAmount': { en: 'Amount is auto-calculated from receipt items and tax.', zh: '金额会根据项目与税额自动计算。' },

  // Expense form errors
  'error.selectDate': { en: 'Please select a date first before fetching the rate.', zh: '请先选择日期再获取汇率。' },
  'error.futureRate': { en: 'Cannot fetch future rate. Rates are only available up to today.', zh: '无法获取未来汇率。汇率仅可获取至今日。' },
  'error.fetchFailed': { en: 'Failed to fetch rate', zh: '获取汇率失败' },
  'error.fetchFailedFinal': { en: 'Failed after multiple attempts. Please switch to manual rate and enter the rate yourself.', zh: '多次尝试失败。请切换为手动汇率并自行输入。' },
  'error.tryAgain': { en: 'Try again or use manual rate.', zh: '请重试或使用手动汇率。' },
  'error.addTravellers': { en: 'Please add travellers first.', zh: '请先添加旅伴。' },
  'error.enterDescription': { en: 'Please enter description.', zh: '请输入描述。' },
  'error.validAmount': { en: 'Please enter a valid amount.', zh: '请输入有效金额。' },
  'error.selectPayer': { en: 'Please select who paid.', zh: '请选择付款人。' },
  'error.selectSplit': { en: 'Please select at least one split person.', zh: '请至少选择一位分摊人。' },
  'error.validManualRate': { en: 'Please enter a valid manual rate.', zh: '请输入有效的手动汇率。' },
  'error.fetchOrManual': { en: 'Please fetch rate or switch to manual mode.', zh: '请获取汇率或切换为手动模式。' },
  'error.itemizedPayer': { en: 'In itemized mode, all payers must have a value.', zh: '逐项模式下，所有付款人必须填入金额。' },
  'error.itemizedTally': { en: 'Please make totals tally before saving.', zh: '请确保金额匹配后再保存。' },
  'error.cannotSave': { en: 'Cannot save expense.', zh: '无法保存支出。' },
  'error.itemizedRemaining': { en: 'Itemized amounts are still remaining by', zh: '逐项金额仍剩余' },
  'error.itemizedExceeding': { en: 'Itemized amounts are still exceeding by', zh: '逐项金额仍超出' },
  'error.tallyNote': { en: 'so they do not tally with the total amount.', zh: '与总金额不匹配。' },
  'error.receiptNeedItem': { en: 'Add at least one valid receipt item before saving.', zh: '请至少添加一条有效的小票项目后再保存。' },
  'error.receiptInvalidItem': { en: 'Each receipt item needs a name, amount, and at least one person.', zh: '每个小票项目都需要名称、金额和至少一位分摊人。' },
  'error.percentageMismatch': { en: 'Percentages must add up to 100% (currently', zh: '百分比总和必须为100%（目前是' },
  'error.sharesAllZero': { en: 'Enter at least one share to split.', zh: '请至少输入一个分摊份数。' },

  // ── Expense Card ──
  'card.paidBy': { en: 'Paid by', zh: '付款人' },
  'card.unknown': { en: 'Unknown', zh: '未知' },
  'card.itemizedSplit': { en: 'Itemized split', zh: '逐项分摊' },
  'card.receiptSplit': { en: 'Receipt split', zh: '小票分摊' },
  'card.equalSplit': { en: '-way equal split', zh: '人均分' },
  'card.payer': { en: '(payer)', zh: '(付款人)' },
  'card.repaid': { en: 'Repaid', zh: '已还款' },
  'card.outstanding': { en: 'Outstanding', zh: '未还款' },
  'card.undo': { en: 'Undo', zh: '撤销' },
  'card.delete': { en: 'Delete', zh: '删除' },
  'card.deleteConfirm': { en: 'Delete expense', zh: '确认删除支出' },

  // ── Summary Tab ──
  'summary.title': { en: 'Expenses', zh: '支出记录' },
  'summary.tripTotal': { en: 'Trip total', zh: '整趟' },
  'summary.filteredTotal': { en: 'Filtered total', zh: '筛选后合计' },
  'summary.yourShare': { en: 'Your share', zh: '你的份' },
  'summary.jumpToDay': { en: 'Jump to day', zh: '跳到某天' },
  'summary.today': { en: 'Today', zh: '今天' },
  'summary.yesterday': { en: 'Yesterday', zh: '昨天' },
  'summary.noDate': { en: 'No date', zh: '未填日期' },
  'summary.emptyTitle': { en: 'Nothing recorded yet', zh: '还没有记录' },
  'summary.emptyHint': { en: 'Tap + to add the first expense of this trip.', zh: '点右下角 + 记下这趟的第一笔。' },
  'summary.clearFilter': { en: 'Clear filter', zh: '清除筛选' },
  'summary.settled': { en: 'Settled', zh: '已结清' },
  'summary.splitTitle': { en: 'Split', zh: '分摊明细' },
  'summary.close': { en: 'Close', zh: '关闭' },
  'summary.category': { en: 'Category:', zh: '类别：' },
  'summary.date': { en: 'Date:', zh: '日期：' },
  'summary.all': { en: 'All', zh: '全部' },
  'summary.allDates': { en: 'All dates', zh: '所有日期' },
  'summary.noRecords': { en: 'No expense records in selected filters.', zh: '当前筛选条件下无支出记录。' },
  'summary.day': { en: 'Day', zh: '第' },
  'summary.dayUnit': { en: '', zh: '天' },
  'summary.expenseCount': { en: 'expense(s)', zh: '笔支出' },
  'summary.converting': { en: '(converting...)', zh: '(转换中...)' },
  'summary.payer': { en: 'Payer', zh: '付款人' },
  'summary.paid': { en: 'Paid', zh: '已还' },
  'summary.unpaid': { en: 'Unpaid', zh: '未还' },
  'summary.settlementTitle': { en: 'Settlement Summary', zh: '结算摘要' },
  'summary.settlementDesc': { en: 'Each row is one expense. Default shows items with unpaid balances. Repaid lines are shown as', zh: '每行为一笔支出。默认显示有未还余额的项目。已还款行显示为' },
  'summary.inCyan': { en: 'in cyan and are excluded from total outstanding.', zh: '的青色标记，不计入总未还金额。' },
  'summary.item': { en: 'Item', zh: '项目' },
  'summary.outstandingRepay': { en: 'Outstanding Repay', zh: '未还金额' },
  'summary.whoOwes': { en: 'Who owes', zh: '谁欠款' },
  'summary.totalOutstanding': { en: 'Total outstanding', zh: '总未还' },
  'summary.noSettlement': { en: 'No settlement rows for current filters.', zh: '当前筛选条件下无结算记录。' },
  'summary.deleteConfirm': { en: 'Warning: Delete expense', zh: '警告：确认删除支出' },
  'summary.expenseEditAffectsSettlement': {
    en: 'This expense edit changes balances for existing settlement records. Continue and keep the payment history, even if some applied amounts become unapplied?',
    zh: '这次账单编辑会影响已有结算记录的余额。是否继续并保留付款历史？若债务变小，部分已分配金额可能会变成未应用状态。',
  },

  // ── Settle Tab ──
  'settle.title': { en: 'All balances', zh: '全部欠款' },
  'settle.payerAll': { en: 'Payer · All', zh: '付款人 · 全部' },
  'settle.debtorAll': { en: 'Debtor · All', zh: '欠款人 · 全部' },
  'settle.allPayers': { en: 'All payers', zh: '所有付款人' },
  'settle.allMembers': { en: 'All members', zh: '所有成员' },
  'settle.noBalances': { en: 'No outstanding balances for this filter.', zh: '当前筛选下无未还余额。' },
  'settle.mySettlement': { en: 'My settlement', zh: '我的结算' },
  'settle.groupOverview': { en: 'Group overview', zh: '整体总览' },
  'settle.yourConclusion': { en: 'Your settlement', zh: '你的结算结论' },
  'settle.youNeedToPay': { en: 'You need to pay', zh: '你需要付款' },
  'settle.friendsNeedToPayYou': { en: 'Friends need to pay you', zh: '朋友需要付你' },
  'settle.youAreAllSet': { en: 'You are all set', zh: '你已经结清' },
  'settle.chooseIdentity': { en: 'Choose your trip identity', zh: '请选择你的旅程身份' },
  'settle.personalHelp': { en: 'Start with these actions. Use Group overview for the full payment route and included items.', zh: '先处理这些行动；完整付款路线和包含项目可在整体总览查看。' },
  'settle.chooseIdentityHelp': { en: 'Link your account to a traveller first so this page can show your personal settlement.', zh: '请先把账号绑定到旅伴身份，页面才会显示你的个人结算。' },
  'settle.youPay': { en: 'You pay', zh: '你付给' },
  'settle.paysYou': { en: 'pays you', zh: '需付你' },
  'settle.tapOverallForItems': { en: 'Check included items below or switch to group overview.', zh: '可在下方查看包含项目，或切换到整体总览。' },
  'settle.waitForPayment': { en: 'Waiting for their payment.', zh: '等待对方付款。' },
  'settle.noExpensesYet': { en: 'No expenses yet.', zh: '还没有支出。' },
  'settle.recordPayment': { en: 'Record a payment', zh: '记录一笔付款' },
  'settle.tapToRecord': { en: 'Tap to record what you paid', zh: '点一下记录你付的款' },
  'settle.tapToRecordReceived': { en: 'Tap to record what they paid you', zh: '点一下记录对方付你的款' },

  // ── Payment details (bank / account), shown where a debt is settled ──
  'pay.details': { en: 'Payment details', zh: '收款方式' },
  'pay.bankName': { en: 'Bank name', zh: '银行名称' },
  'pay.accountHolder': { en: 'Account holder', zh: '账户持有人' },
  'pay.accountNumber': { en: 'Account number', zh: '账号' },
  'pay.copy': { en: 'Copy', zh: '复制' },
  'pay.copied': { en: 'Copied', zh: '已复制' },
  'pay.myDetails': { en: 'My payment details', zh: '我的收款方式' },
  'pay.myDetailsHelp': { en: 'Friends who owe you see this next to your name in Settle Up, so they can transfer without asking.', zh: '欠你钱的旅伴会在结算页你的名字旁看到这些资料，不用再问你一次。' },
  'pay.none': { en: 'Not filled in yet', zh: '还没填' },
  'pay.fillIn': { en: 'Fill in', zh: '去填写' },
  'pay.needIdentity': { en: 'Pick which traveller is you first, then you can fill in your payment details.', zh: '请先选择你是哪位旅伴，才能填写自己的收款方式。' },
  'settle.noPersonalAction': { en: 'All settled. No personal action needed right now.', zh: '已经结清，目前你无需操作。' },
  'settle.overallRoutes': { en: 'Payment routes', zh: '付款路线' },
  'settle.overallHelp': { en: 'This shows the full group route and detailed included items for everyone.', zh: '这里显示所有人的完整付款路线和详细包含项目。' },
  'settle.myIncludedItems': { en: 'Included items for you', zh: '与你有关的项目' },
  'settle.myIncludedItemsHelp': { en: 'Only expenses where you owe someone or someone owes you.', zh: '只显示你需要付款或别人需要付你的支出。' },
  'settle.groupIncludedItemsHelp': { en: 'All outstanding expense lines for this trip.', zh: '这趟旅程所有未结算的支出明细。' },
  'settle.statementPreviewLabel': { en: 'Final trip statement', zh: '最终旅程账单' },
  'settle.statementTitle': { en: 'Statement preview', zh: '账单预览' },
  'settle.statementHelp': { en: 'A clear summary you can copy now. PDF and image export can build on this layout later.', zh: '现在可先复制清楚摘要；之后 PDF 和图片导出会基于这个版式继续完善。' },
  'settle.copyPersonalStatement': { en: 'Copy my statement', zh: '复制我的账单' },
  'settle.copyGroupStatement': { en: 'Copy group statement', zh: '复制整体账单' },
  'settle.personalStatement': { en: 'Personal statement', zh: '个人账单' },
  'settle.groupStatement': { en: 'Group statement', zh: '整体账单' },
  'settle.totalSpend': { en: 'Total spend', zh: '总花费' },
  'settle.openRoutes': { en: 'Open payment routes', zh: '待处理付款路线' },
  'settle.across': { en: 'across', zh: '跨' },
  'settle.needsToPay': { en: 'needs to pay', zh: '需要还给' },
  'settle.expenseCount': { en: 'expense(s)', zh: '笔支出' },
  'settle.splitLines': { en: 'split line(s)', zh: '条分摊记录' },
  'settle.tapToSeeBreakdown': { en: 'Tap to see breakdown', zh: '点击查看明细' },
  'settle.breakdownTitle': { en: 'Outstanding Breakdown', zh: '未还明细' },
  'settle.breakdownSubtitle': { en: 'Expenses included in this balance', zh: '包含在此余额中的支出' },
  'settle.breakdownOwes': { en: 'owes', zh: '欠' },
  'settle.markRepaid': { en: 'Mark as repaid', zh: '标记为已还' },
  'settle.netBadge': { en: 'Net', zh: '净额' },
  'settle.contraBadge': { en: 'contra', zh: '互抵' },
  'settle.settledBadge': { en: 'Settled', zh: '已结清' },
  'settle.due': { en: 'due', zh: '待还' },
  'settle.totalSummary': { en: 'Total Summary', zh: '总结' },
  'settle.outstandingTotals': { en: 'Outstanding totals for current filters', zh: '当前筛选的未还总额' },
  'settle.noOutstanding': { en: 'No outstanding amount.', zh: '无未还金额。' },
  'settle.overallOutstanding': { en: 'Overall outstanding', zh: '总体未还' },
  'settle.owes': { en: 'owes', zh: '欠' },
  'settle.beforeContra': { en: 'net remaining (before offset)', zh: '净余额（抵消前）' },
  'settle.noDirectDebt': { en: 'No direct debt found.', zh: '未发现直接欠款。' },
  'settle.contra': { en: 'Contra (two-way, same currency)', zh: '互抵（双向，同币种）' },
  'settle.canOffset': { en: 'net remaining, can be offset', zh: '净余额，可用于抵消' },
  'settle.noContra': { en: 'No contra amount.', zh: '无互抵金额。' },
  'settle.netAfterContra': { en: 'Net after contra', zh: '抵消后净额' },
  'settle.settledIn': { en: 'are settled in', zh: '已在' },
  'settle.afterContra': { en: 'after contra.', zh: '中抵消结清。' },
  'settle.stillPay': { en: 'still needs to pay', zh: '仍需支付给' },
  'settle.repayAll': { en: 'Repay all', zh: '全部还款' },
  'settle.noNeedPay': { en: 'does not need to pay;', zh: '不需要支付；' },
  'settle.stillOwes': { en: 'still owes', zh: '仍欠' },
  'settle.noNet': { en: 'No net amount.', zh: '无净额。' },
  'settle.recentRepaid': { en: 'Recent Repaid', zh: '最近还款' },
  'settle.historyTitle': { en: 'Settlement History', zh: '结算历史' },
  'settle.noRepaid': { en: 'No repaid records yet.', zh: '暂无还款记录。' },
  'settle.repaidOn': { en: 'Repaid on', zh: '还款日期' },
  'settle.repayModal': { en: 'Repay all matching shares', zh: '偿还所有匹配分摊' },
  'settle.repayDesc': { en: 'Confirm this payment to settle all matching unpaid lines for this payer/debtor pair in one action.', zh: '确认此付款以一次性结清该付款人/欠款人对的所有未还记录。' },
  'settle.pays': { en: 'pays', zh: '支付给' },
  'settle.amountAfterContra': { en: 'Amount to pay after contra:', zh: '抵消后需支付金额：' },
  'settle.linesToMark': { en: 'Lines to mark repaid:', zh: '标记为已还的行数：' },
  'settle.confirm': { en: 'Confirm', zh: '确认' },
  'settle.confirmRepaid': { en: 'Confirm Mark as Repaid', zh: '确认标记为已还' },
  'settle.confirmRepaidDesc': { en: 'Are you sure you want to mark this settlement as repaid?', zh: '确定要将此结算标记为已还吗？' },
  'settle.doNotShowAgain': { en: 'Do not show this again', zh: '不再显示此提示' },
  'settle.switchCurrencyToOpen': { en: 'This balance includes multiple currencies. Switch repay currency to one of these before opening:…20803 tokens truncated… 'Correction of {{name}}', zh: '{{name}} 的更正版本' },
  'history.earlierPrivate': { en: 'An earlier version is unavailable with your current access.', zh: '根据你目前的访问权限，较早版本无法显示。' },
  'history.replacementPrivate': { en: 'The corrected version is unavailable with your current access.', zh: '根据你目前的访问权限，更正版本无法显示。' },
  'history.cancelledHelp': { en: 'This expense was cancelled and no longer contributes.', zh: '此支出已取消，不再计入。' },
  'history.correctedHelp': { en: 'This expense was replaced by a corrected version.', zh: '此支出已由更正版本取代。' },
  'history.legacyHelp': { en: 'The older record does not contain enough detail to classify its lifecycle safely.', zh: '此旧记录没有足够资料可安全判断其生命周期。' },
  'history.settlementLabel': { en: 'Settlement history', zh: '结算历史' },
  'history.settlementTitle': { en: 'Payment facts', zh: '付款事实' },
  'history.settlementHelp': { en: 'Accepted amounts remain historical facts. Current application is shown separately.', zh: '已接受金额会保留为历史事实；当前应用情况会另行显示。' },
  'history.settlementDirection': { en: '{{debtor}} paid {{creditor}}', zh: '{{debtor}} 支付给 {{creditor}}' },
  'history.privateParticipant': { en: 'Participant', zh: '参与者' },
  'history.settlementProposed': { en: 'Settlement proposed', zh: '已提出结算' },
  'history.settlementAccepted': { en: 'Settlement accepted', zh: '结算已接受' },
  'history.settlementDeclined': { en: 'Settlement declined', zh: '结算已拒绝' },
  'history.settlementProposalCancelled': { en: 'Proposal cancelled before acceptance', zh: '提议已在接受前取消' },
  'history.settlementReversed': { en: 'Later reversed', zh: '之后已冲销' },
  'history.settlementLegacyReversed': { en: 'Later reversed (legacy record)', zh: '之后已冲销（旧记录）' },
  'history.currentDerived': { en: 'Current explanation · Derived', zh: '当前说明 · 推导值' },
  'history.currentlyApplied': { en: 'Currently applied: {{amount}}', zh: '当前应用：{{amount}}' },
  'history.currentCredit': { en: 'Current credit: {{amount}}', zh: '当前抵扣余额：{{amount}}' },
  'history.unavailable': { en: 'Financial history is unavailable because its records are inconsistent.', zh: '财务记录不一致，因此无法显示历史。' },

  'activity.label': { en: 'Activity', zh: '活动' },
  'activity.title': { en: 'Audit trail', zh: '审计记录' },
  'activity.empty': { en: 'No visible activity yet.', zh: '还没有可见活动。' },
  'activity.event.space.created': { en: 'Group or trip created', zh: '已创建群组或旅程' },
  'activity.event.space.updated': { en: 'Group or trip updated', zh: '已更新群组或旅程' },
  'activity.event.space.manual_member_added': { en: 'Untracked person added', zh: '已添加未追踪成员' },
  'activity.event.space.member_role_updated': { en: 'Member access updated', zh: '已更新成员权限' },
  'activity.event.space.member_removed': { en: 'Member removed', zh: '已移除成员' },
  'activity.event.space.invite_revoked': { en: 'Invite revoked', zh: '已撤销邀请' },
  'activity.event.expense.created': { en: 'Expense created', zh: '已创建支出' },
  'activity.event.expense.metadata_updated': { en: 'Expense details updated', zh: '已更新支出资料' },
  'activity.event.expense.financials_replaced': { en: 'Expense financial details edited', zh: '已编辑支出财务资料' },
  'activity.event.expense.manual_participant_linked': { en: 'Historical participant linked', zh: '已绑定历史成员' },
  'activity.event.expense.voided': { en: 'Expense voided (legacy)', zh: '支出已作废（旧记录）' },
  'activity.event.expense.correction_proposed': { en: 'Correction proposed', zh: '已提出更正' },
  'activity.event.expense.correction_approval_accepted': { en: 'Correction approval accepted', zh: '更正批准已接受' },
  'activity.event.expense.correction_declined': { en: 'Correction declined', zh: '更正已拒绝' },
  'activity.event.expense.correction_proposal_cancelled': { en: 'Correction withdrawn', zh: '更正已撤回' },
  'activity.event.expense.corrected': { en: 'Correction approved', zh: '更正已批准' },
  'activity.event.expense.cancellation_requested': { en: 'Cancellation requested', zh: '已请求取消' },
  'activity.event.expense.cancellation_approval_accepted': { en: 'Cancellation approval accepted', zh: '取消批准已接受' },
  'activity.event.expense.cancellation_declined': { en: 'Cancellation declined', zh: '取消已拒绝' },
  'activity.event.expense.cancellation_request_cancelled': { en: 'Cancellation request withdrawn', zh: '取消请求已撤回' },
  'activity.event.expense.cancelled': { en: 'Expense cancelled', zh: '支出已取消' },
  'activity.event.expense.restored': { en: 'Expense restored', zh: '支出已恢复' },
  'activity.event.direct.accepted': { en: 'Direct Split accepted', zh: '已接受直接分摊' },
  'activity.event.direct.declined': { en: 'Direct Split declined', zh: '已拒绝直接分摊' },
  'activity.event.settlement.proposed': { en: 'Settlement proposed', zh: '已提出结算' },
  'activity.event.settlement.allocation_accepted': { en: 'Settlement accepted', zh: '结算已接受' },
  'activity.event.settlement.allocation_declined': { en: 'Settlement declined', zh: '已拒绝结算' },
  'activity.event.settlement.allocation_cancelled': { en: 'Settlement proposal cancelled', zh: '结算提议已取消' },
  'activity.event.settlement.allocation_reversed': { en: 'Settlement reversed', zh: '已撤销结算' },
  'activity.event.updated': { en: 'Financial activity updated', zh: '财务活动已更新' },

  'friendlyError.generic': { en: 'Something went wrong. Please try again.', zh: '出现问题，请重试。' },
  'friendlyError.notConfigured': { en: 'The online service is not configured yet.', zh: '在线服务尚未配置。' },
  'friendlyError.notAuthenticated': { en: 'Sign in and try again.', zh: '请登录后重试。' },
  'friendlyError.accountRequired': { en: 'A permanent account is required for this action.', zh: '此操作需要正式账号。' },
  'friendlyError.accessDenied': { en: 'You do not have permission to do that.', zh: '你没有执行此操作的权限。' },
  'friendlyError.notFound': { en: 'This item is no longer available.', zh: '此项目已不可用。' },
  'friendlyError.invalid': { en: 'Check the entered details and try again.', zh: '请检查输入资料后重试。' },
  'friendlyError.versionConflict': { en: 'This item changed on another device. Refresh and try again.', zh: '此项目已在其他设备更新。请刷新后重试。' },
  'friendlyError.inviteUnavailable': { en: 'This invite is invalid, expired, revoked, or already used.', zh: '此邀请无效、已过期、已撤销或已使用。' },
  'friendlyError.balanceExceeded': { en: 'The payment cannot exceed the outstanding balance.', zh: '付款金额不能超过待付余额。' },
  'friendlyError.settlementIntentRequired': { en: 'Choose Full or Partial before continuing.', zh: '继续前请选择全部或部分付款。' },
  'friendlyError.partialAmountRequired': { en: 'Enter a partial payment amount.', zh: '请输入部分付款金额。' },
  'friendlyError.requestChanged': { en: 'This request changed. Refresh and review its current state.', zh: '此请求已变化，请刷新并检查当前状态。' },
  'friendlyError.undoUnavailable': { en: 'Undo is no longer safe because syncing started or the expense changed.', zh: '同步已开始或支出已变化，无法安全撤销。' },
  'friendlyError.correctionRestriction': { en: 'Keep the same currency, participants, and participant order, or cancel and create a new expense.', zh: '请保持相同货币、参与者及顺序，否则请取消并新建支出。' },
  'friendlyError.financialStateUnavailable': { en: 'This financial state is inconsistent. Actions are disabled until it is safely refreshed.', zh: '此财务状态不一致，在安全刷新前已禁用操作。' },
  'friendlyError.saveExpense': { en: 'Could not save this expense. Please try again.', zh: '无法保存此支出，请重试。' },
  'friendlyError.load': { en: 'Could not load this information. Please try again.', zh: '无法加载资料，请重试。' },
} as const

export type TranslationKey = keyof typeof translations

export type TranslationParams = Readonly<Record<string, string | number>>

export function missingTranslationKeys(
  lang: Lang,
  prefixes?: readonly string[],
): TranslationKey[] {
  return (Object.keys(translations) as TranslationKey[]).filter((key) => {
    if (prefixes && !prefixes.some((prefix) => key.startsWith(prefix))) return false
    const value = translations[key][lang]
    return typeof value !== 'string' || value.trim() === ''
  })
}

function interpolate(value: string, params?: TranslationParams): string {
  if (!params) return value
  return value.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ))
}

export function t(key: TranslationKey, lang?: Lang, params?: TranslationParams): string {
  const entry = translations[key]
  const activeLang = lang ?? useStore.getState().lang
  return interpolate(entry?.[activeLang] ?? entry?.en ?? key, params)
}

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: TranslationKey, params?: TranslationParams) => {
    const entry = translations[key]
    return interpolate(entry?.[lang] ?? entry?.en ?? key, params)
  }
}

export function countKey(
  one: TranslationKey,
  many: TranslationKey,
  count: number,
): TranslationKey {
  return count === 1 ? one : many
}

export function categoryKey(category: string): TranslationKey {
  const aliases: Record<string, TranslationKey> = {
    Transport: 'cat.Transportation',
    Stay: 'cat.Accommodation',
  }
  const key = `cat.${category}` as TranslationKey
  return aliases[category] ?? (translations[key] ? key : 'cat.Other')
}

export function roleKey(role: string): TranslationKey {
  if (role === 'owner') return 'role.owner'
  if (role === 'full_access') return 'role.full_access'
  return 'role.view'
}

export function scopeKey(scope: string): TranslationKey {
  if (scope === 'personal') return 'scope.personal'
  if (scope === 'direct') return 'scope.direct'
  return 'scope.space'
}

export function spaceTypeKey(type: string): TranslationKey {
  return type === 'trip' ? 'spaceType.trip' : 'spaceType.group'
}

export function personStateKey(state: string): TranslationKey {
  if (state === 'linked') return 'person.state.linked'
  if (state === 'link-pending') return 'person.state.link-pending'
  return 'person.state.manual'
}

export function spaceStatusKey(status: string): TranslationKey {
  if (status === 'archived') return 'space.status.archived'
  if (status === 'voided') return 'space.status.voided'
  return 'space.status.active'
}

export function captureSourceKey(source: string): TranslationKey {
  const key = `capture.source.${source}` as TranslationKey
  return translations[key] ? key : 'capture.source.manual'
}

export function activityEventKey(eventType: string): TranslationKey {
  const key = `activity.event.${eventType}` as TranslationKey
  return translations[key] ? key : 'activity.event.updated'
}

export function machineCode(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? '')
  const knownCode = message.match(/[a-z][a-z0-9_]+/g)?.find((part) => part.includes('_'))
  return knownCode ?? message.trim().toLowerCase()
}

export function captureMessageKey(value: unknown): TranslationKey {
  const code = machineCode(value)
  const keys: Record<string, TranslationKey> = {
    permission_denied: 'capture.error.permission',
    unavailable: 'capture.error.voiceUnavailable',
    no_speech: 'capture.error.noSpeech',
    provider_unavailable: 'capture.error.ocrUnavailable',
    invalid_image: 'capture.error.invalidImage',
    image_too_large: 'capture.error.imageTooLarge',
    no_text: 'capture.error.noText',
    capture_quota_exceeded: 'capture.error.quota',
    capture_rate_limit_exceeded: 'capture.error.rate',
    capture_entitlement_inactive: 'capture.error.inactive',
  }
  return keys[code] ?? 'capture.error.unavailable'
}

export function captureWarningKey(value: string): TranslationKey {
  const keys: Record<string, TranslationKey> = {
    empty_transcript: 'capture.warning.emptyTranscript',
    amount_not_found: 'capture.warning.amountMissing',
    multiple_amounts: 'capture.warning.multipleAmounts',
    currency_not_found: 'capture.warning.currencyMissing',
    ambiguous_currency_symbol: 'capture.warning.currencyAmbiguous',
    conflicting_currencies: 'capture.warning.currencyConflict',
    ambiguous_date: 'capture.warning.dateAmbiguous',
    ambiguous_category: 'capture.warning.categoryAmbiguous',
    participant_split_requires_review: 'capture.warning.participantReview',
  }
  return keys[value] ?? 'capture.error.unavailable'
}

export function friendlyErrorKey(value: unknown): TranslationKey {
  const code = machineCode(value)
  if (code === 'not_configured') return 'friendlyError.notConfigured'
  if (code === 'not_authenticated') return 'friendlyError.notAuthenticated'
  if (code === 'permanent_account_required') return 'friendlyError.accountRequired'
  if (code === 'version_conflict') return 'friendlyError.versionConflict'
  if (code === 'invite_unavailable' || code.includes('invite_not_found')) {
    return 'friendlyError.inviteUnavailable'
  }
  if (code === 'amount_exceeds_outstanding_balance') return 'friendlyError.balanceExceeded'
  if (code === 'settlement_intent_required') return 'friendlyError.settlementIntentRequired'
  if (code === 'partial_amount_required') return 'friendlyError.partialAmountRequired'
  if (code === 'financial_invariant_violation') return 'friendlyError.financialStateUnavailable'
  if (
    code === 'command_already_dispatching'
    || code === 'expense_not_restorable'
  ) return 'friendlyError.undoUnavailable'
  if (
    code === 'change_request_exists'
    || code === 'request_not_pending'
    || code === 'change_request_not_pending'
    || code === 'change_request_not_found'
    || code === 'change_request_terminal_conflict'
    || code === 'target_changed'
    || code === 'replacement_changed'
  ) return 'friendlyError.requestChanged'
  if (
    code === 'currency_change_requires_cancel_and_new'
    || code === 'participant_set_mismatch'
    || code === 'participant_order_mismatch'
    || code === 'historical_manual_participant_required'
  ) return 'friendlyError.correctionRestriction'
  if (
    code.includes('denied')
    || code.endsWith('_required')
    || code.includes('owner_')
    || code.includes('write_')
  ) return 'friendlyError.accessDenied'
  if (code.includes('not_found') || code.includes('unavailable') || code.includes('archived')) {
    return 'friendlyError.notFound'
  }
  if (
    code.startsWith('invalid_')
    || code.startsWith('duplicate_')
    || code.includes('does_not_reconcile')
    || code.includes('conflict')
  ) return 'friendlyError.invalid'
  return 'friendlyError.generic'
}

export function tCategory(category: string, lang?: Lang): string {
  const key = `cat.${category}` as TranslationKey
  const entry = translations[key as keyof typeof translations]
  const activeLang = lang ?? useStore.getState().lang
  if (entry) return entry[activeLang] ?? entry.en
  return category
}
