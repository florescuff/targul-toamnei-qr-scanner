import React from 'react';
import type { Voucher } from '../types.ts';

interface DashboardProps {
  vouchers: Voucher[];
}

const statusColors: { [key in Voucher['status']]: string } = {
  'Nefolosit': 'bg-blue-100 text-blue-800',
  'Parțial': 'bg-yellow-100 text-yellow-800',
  'Folosit': 'bg-green-100 text-green-800',
};

const Dashboard: React.FC<DashboardProps> = ({ vouchers }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <div className="overflow-x-auto">
        <h3 className="text-2xl font-bold text-gray-700 mb-4">Lista Vouchere ({vouchers.length})</h3>
        <div className="max-h-[80vh] overflow-y-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr. Bon</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ultimul Scan</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Scanări Zâne Bune</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Scanări The Sailor</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{voucher.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[voucher.status]}`}>
                      {voucher.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {voucher.last_scan ? new Date(voucher.last_scan).toLocaleString('ro-RO') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{voucher.scans_op1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{voucher.scans_op2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
