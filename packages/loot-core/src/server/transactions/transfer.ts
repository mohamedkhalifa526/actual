// @ts-strict-ignore
import * as db from '#server/db';
import {
  computeCounterpartyAmount,
  getAccountCurrency,
  getBudgetAmountForTransferLeg,
  isCrossCurrencyTransfer,
} from '#shared/currency-transfer';

import { runRules } from './transaction-rules';

async function getDefaultCurrencyCode() {
  const pref = await db.first<{ value: string }>(
    `SELECT value FROM preferences WHERE id = 'defaultCurrencyCode'`,
  );
  return pref?.value ?? '';
}

async function getAccountCurrencyCode(accountId: string) {
  const account = await db.first<Pick<db.DbAccount, 'currency'>>(
    'SELECT currency FROM accounts WHERE id = ?',
    [accountId],
  );
  return getAccountCurrency(account, await getDefaultCurrencyCode());
}

async function isCrossCurrency(accountId: string, otherAccountId: string) {
  const defaultCurrencyCode = await getDefaultCurrencyCode();
  const fromAccount = await db.first<Pick<db.DbAccount, 'currency'>>(
    'SELECT currency FROM accounts WHERE id = ?',
    [accountId],
  );
  const toAccount = await db.first<Pick<db.DbAccount, 'currency'>>(
    'SELECT currency FROM accounts WHERE id = ?',
    [otherAccountId],
  );
  return isCrossCurrencyTransfer(fromAccount, toAccount, defaultCurrencyCode);
}

function getCounterpartyAmount(transaction, transferredAccount, exchangeRate) {
  return computeCounterpartyAmount(transaction.amount, exchangeRate);
}

async function getPayee(acct) {
  return db.first<db.DbPayee>('SELECT * FROM payees WHERE transfer_acct = ?', [
    acct,
  ]);
}

async function getTransferredAccount(transaction) {
  if (transaction.payee) {
    const result = await db.first<Pick<db.DbViewPayee, 'transfer_acct'>>(
      'SELECT transfer_acct FROM v_payees WHERE id = ?',
      [transaction.payee],
    );

    return result?.transfer_acct || null;
  }
  return null;
}

async function clearCategory(transaction, transferAcct) {
  const { offbudget: fromOffBudget } = await db.first<
    Pick<db.DbAccount, 'offbudget'>
  >('SELECT offbudget FROM accounts WHERE id = ?', [transaction.account]);
  const { offbudget: toOffBudget } = await db.first<
    Pick<db.DbAccount, 'offbudget'>
  >('SELECT offbudget FROM accounts WHERE id = ?', [transferAcct]);

  // If the transfer is between two on budget or two off budget accounts,
  // we should clear the category, because the category is not relevant
  if (fromOffBudget === toOffBudget) {
    await db.updateTransaction({ id: transaction.id, category: null });
    if (transaction.transfer_id) {
      await db.updateTransaction({
        id: transaction.transfer_id,
        category: null,
      });
    }
    return true;
  }
  return false;
}

export async function addTransfer(transaction, transferredAccount) {
  if (transaction.is_parent) {
    // For split transactions, we should create transfers using child transactions.
    // This is to ensure that the amounts received by the transferred account
    // reflects the amounts in the child transactions and not the parent transaction
    // amount which is the total amount.
    return null;
  }

  const { id: fromPayee } = await db.first<Pick<db.DbPayee, 'id'>>(
    'SELECT id FROM payees WHERE transfer_acct = ?',
    [transaction.account],
  );

  const crossCurrency = await isCrossCurrency(
    transaction.account,
    transferredAccount,
  );
  const exchangeRate = crossCurrency ? transaction.exchange_rate ?? 1 : null;
  const counterpartyAmount = crossCurrency
    ? getCounterpartyAmount(transaction, transferredAccount, exchangeRate)
    : -transaction.amount;

  const mainCurrency = (await getDefaultCurrencyCode()).trim();
  const sourceCurrency = await getAccountCurrencyCode(transaction.account);
  const destCurrency = await getAccountCurrencyCode(transferredAccount);
  const sourceBudgetAmount =
    transaction.budget_amount ??
    getBudgetAmountForTransferLeg(
      transaction.amount,
      sourceCurrency,
      counterpartyAmount,
      destCurrency,
      mainCurrency,
      exchangeRate,
    );
  const destBudgetAmount = getBudgetAmountForTransferLeg(
    counterpartyAmount,
    destCurrency,
    transaction.amount,
    sourceCurrency,
    mainCurrency,
    exchangeRate,
  );

  const transferTransaction = {
    account: transferredAccount,
    amount: counterpartyAmount,
    payee: fromPayee,
    date: transaction.date,
    transfer_id: transaction.id,
    notes: transaction.notes || null,
    schedule: transaction.schedule,
    cleared: false,
    exchange_rate: exchangeRate,
    budget_amount: destBudgetAmount,
  };
  const { notes, cleared, schedule } = await runRules(transferTransaction);
  const matchedSchedule = schedule ?? transaction.schedule;

  const id = await db.insertTransaction({
    ...transferTransaction,
    notes,
    cleared,
    schedule: matchedSchedule,
  });

  await db.updateTransaction({
    id: transaction.id,
    transfer_id: id,
    exchange_rate: exchangeRate,
    budget_amount: sourceBudgetAmount,
    ...(matchedSchedule ? { schedule: matchedSchedule } : {}),
  });
  const categoryCleared = await clearCategory(transaction, transferredAccount);

  return {
    id: transaction.id,
    transfer_id: id,
    exchange_rate: exchangeRate,
    budget_amount: sourceBudgetAmount,
    ...(categoryCleared ? { category: null } : {}),
  };
}

export async function removeTransfer(transaction) {
  const transferTrans = await db.getTransaction(transaction.transfer_id);

  // Perform operations on the transfer transaction only
  // if it is found. For example: when users delete both
  // (in & out) transfer transactions at the same time -
  // transfer transaction will not be found.
  if (transferTrans) {
    if (transferTrans.is_child) {
      // If it's a child transaction, we don't delete it because that
      // would invalidate the whole split transaction. Instead of turn
      // it into a normal transaction
      await db.updateTransaction({
        id: transaction.transfer_id,
        transfer_id: null,
        payee: null,
        exchange_rate: null,
        budget_amount: null,
      });
    } else {
      await db.deleteTransaction({ id: transaction.transfer_id });
    }
  }
  await db.updateTransaction({
    id: transaction.id,
    transfer_id: null,
    exchange_rate: null,
    budget_amount: null,
  });
  return {
    id: transaction.id,
    transfer_id: null,
    exchange_rate: null,
    budget_amount: null,
  };
}

export async function updateTransfer(transaction, transferredAccount) {
  const payee = await getPayee(transaction.account);

  const crossCurrency = await isCrossCurrency(
    transaction.account,
    transferredAccount,
  );
  const exchangeRate = crossCurrency ? transaction.exchange_rate ?? 1 : null;
  const counterpartyAmount = crossCurrency
    ? getCounterpartyAmount(transaction, transferredAccount, exchangeRate)
    : -transaction.amount;

  const mainCurrency = (await getDefaultCurrencyCode()).trim();
  const sourceCurrency = await getAccountCurrencyCode(transaction.account);
  const destCurrency = await getAccountCurrencyCode(transferredAccount);
  const sourceBudgetAmount =
    transaction.budget_amount ??
    getBudgetAmountForTransferLeg(
      transaction.amount,
      sourceCurrency,
      counterpartyAmount,
      destCurrency,
      mainCurrency,
      exchangeRate,
    );
  const destBudgetAmount = getBudgetAmountForTransferLeg(
    counterpartyAmount,
    destCurrency,
    transaction.amount,
    sourceCurrency,
    mainCurrency,
    exchangeRate,
  );

  await db.updateTransaction({
    id: transaction.transfer_id,
    account: transferredAccount,
    // Make sure to update the payee on the other side in case the
    // user moved this transaction into another account
    payee: payee.id,
    notes: transaction.notes,
    amount: counterpartyAmount,
    schedule: transaction.schedule,
    exchange_rate: exchangeRate,
    budget_amount: destBudgetAmount,
  });

  if (!crossCurrency && transaction.exchange_rate != null) {
    await db.updateTransaction({
      id: transaction.id,
      exchange_rate: null,
      budget_amount: null,
    });
  } else if (crossCurrency) {
    await db.updateTransaction({
      id: transaction.id,
      exchange_rate: exchangeRate,
      budget_amount: sourceBudgetAmount,
    });
  }

  const categoryCleared = await clearCategory(transaction, transferredAccount);
  if (categoryCleared) {
    return {
      id: transaction.id,
      category: null,
      exchange_rate: exchangeRate,
      budget_amount: sourceBudgetAmount,
    };
  }

  return {
    id: transaction.id,
    exchange_rate: exchangeRate,
    budget_amount: sourceBudgetAmount,
  };
}

export async function onInsert(transaction) {
  const transferredAccount = await getTransferredAccount(transaction);

  if (transferredAccount) {
    return addTransfer(transaction, transferredAccount);
  }
}

export async function onDelete(transaction) {
  if (transaction.transfer_id) {
    await removeTransfer(transaction);
  }
}

export async function onUpdate(transaction) {
  const transferredAccount = await getTransferredAccount(transaction);

  if (transaction.is_parent) {
    return removeTransfer(transaction);
  }

  if (transferredAccount && !transaction.transfer_id) {
    return addTransfer(transaction, transferredAccount);
  }

  if (!transferredAccount && transaction.transfer_id) {
    return removeTransfer(transaction);
  }

  if (transferredAccount && transaction.transfer_id) {
    return updateTransfer(transaction, transferredAccount);
  }
}
