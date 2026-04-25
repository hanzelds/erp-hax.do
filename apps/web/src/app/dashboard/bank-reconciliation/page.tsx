import { redirect } from 'next/navigation'

export default function BankReconciliationRedirect() {
  redirect('/dashboard/bank-accounts')
}
