import React, { useState } from 'react';
import { HISTORICAL_DATA, STORES, DONUT_VARIETIES } from '../data/mockData';
import { BarChart2, PieChart, TrendingUp, DollarSign, Calendar, Store } from 'lucide-react';

const getWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

const StatsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeek(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const getFilteredData = () => {
    const today = new Date();
    const data = [...HISTORICAL_DATA];
    
    switch (selectedPeriod) {
      case 'day':
        const selectedDateObj = new Date(selectedDate);
        return data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.toISOString().split('T')[0] === selectedDate;
        });
        
      case 'week':
        return data.filter(item => {
          const itemDate = new Date(item.date);
          return getWeek(itemDate) === selectedWeek && 
                 itemDate.getFullYear() === selectedYear;
        });
        
      case 'month':
        return data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() + 1 === selectedMonth && 
                 itemDate.getFullYear() === selectedYear;
        });
        
      case 'year':
        return data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getFullYear() === selectedYear;
        });
        
      default:
        return data;
    }
  };
  
  const data = getFilteredData();
  
  const totalProduction = data.reduce((sum, day) => sum + day.production, 0);
  const avgDailyProduction = Math.round(totalProduction / (data.length || 1));
  const totalWaste = data.reduce((sum, day) => sum + day.waste, 0);
  const avgWastePercent = (data.reduce((sum, day) => sum + day.wastePercent, 0) / (data.length || 1)).toFixed(2);
  
  const costPerDonut = 0.50; // Coût en CHF
  const totalCost = totalProduction * costPerDonut;
  const avgDailyCost = totalCost / (data.length || 1);
  
  const storePerformance = STORES.filter(store => store.isActive).map(store => ({
    id: store.id,
    name: store.name,
    production: Math.floor(Math.random() * (totalProduction * 0.4)) + totalProduction * 0.1,
    waste: Math.floor(Math.random() * 8) + 2
  }));
  
  const varietyPopularity = DONUT_VARIETIES.filter(v => v.isActive).map(variety => ({
    id: variety.id,
    name: variety.name,
    percentage: Math.floor(Math.random() * 30) + 5
  })).sort((a, b) => b.percentage - a.percentage);

  // Générer les options pour les semaines
  const getWeekOptions = () => {
    const options = [];
    for (let i = 1; i <= 53; i++) {
      options.push(
        <option key={i} value={i}>Semaine {i}</option>
      );
    }
    return options;
  };

  // Générer les options pour les mois
  const getMonthOptions = () => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months.map((month, index) => (
      <option key={index + 1} value={index + 1}>{month}</option>
    ));
  };

  // Générer les options pour les années
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let year = currentYear - 5; year <= currentYear; year++) {
      options.push(
        <option key={year} value={year}>{year}</option>
      );
    }
    return options;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-gray-600 mt-1">Analyse de la production et des coûts</p>
        </div>
        
        <div className="mt-4 sm:mt-0 space-y-4">
          <div className="flex space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
            >
              <option value="day">Par Jour</option>
              <option value="week">Par Semaine</option>
              <option value="month">Par Mois</option>
              <option value="year">Par Année</option>
            </select>

            {selectedPeriod === 'day' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              />
            )}

            {selectedPeriod === 'week' && (
              <div className="flex space-x-2">
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getWeekOptions()}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getYearOptions()}
                </select>
              </div>
            )}

            {selectedPeriod === 'month' && (
              <div className="flex space-x-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getMonthOptions()}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getYearOptions()}
                </select>
              </div>
            )}

            {selectedPeriod === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              >
                {getYearOptions()}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-krispy-green">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Production Totale</p>
              <p className="text-2xl font-bold text-gray-900">{totalProduction.toLocaleString()} doughnuts</p>
              <p className="text-sm text-gray-500">
                {avgDailyProduction.toLocaleString()} moyenne journalière
              </p>
            </div>
            <div className="bg-krispy-green bg-opacity-10 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-krispy-green" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-krispy-green">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Déchets Moyens</p>
              <p className="text-2xl font-bold text-gray-900">{avgWastePercent}%</p>
              <p className="text-sm text-gray-500">
                {totalWaste.toLocaleString()} doughnuts perdus
              </p>
            </div>
            <div className="bg-krispy-green bg-opacity-10 p-3 rounded-lg">
              <BarChart2 className="h-6 w-6 text-krispy-green" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-krispy-green">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Coût Total</p>
              <p className="text-2xl font-bold text-gray-900">CHF {totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-sm text-gray-500">
                CHF {avgDailyCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} moyenne journalière
              </p>
            </div>
            <div className="bg-krispy-green bg-opacity-10 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-krispy-green" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-krispy-green">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Coût par Doughnut</p>
              <p className="text-2xl font-bold text-gray-900">CHF {costPerDonut.toFixed(2)}</p>
              <p className="text-sm text-gray-500">
                Coût de production uniquement
              </p>
            </div>
            <div className="bg-krispy-green bg-opacity-10 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-krispy-green" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-krispy-green" />
              Tendance de Production
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <BarChart2 className="h-48 w-48 text-krispy-green" />
            </div>
            <div className="text-center text-sm text-gray-600 mt-4">
              Production journalière sur la période sélectionnée
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-krispy-green" />
              Popularité des Variétés
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <PieChart className="h-48 w-48 text-krispy-green" />
            </div>
            <div className="space-y-2 mt-4">
              {varietyPopularity.slice(0, 5).map((variety, index) => (
                <div key={variety.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 inline-block rounded-full mr-2 ${
                      index === 0 ? 'bg-krispy-green' :
                      index === 1 ? 'bg-krispy-green-light' :
                      index === 2 ? 'bg-krispy-green-dark' :
                      index === 3 ? 'bg-krispy-red' :
                      'bg-krispy-red-light'
                    }`}></span>
                    <span className="text-sm text-gray-600">{variety.name}</span>
                  </div>
                  <span className="text-sm text-gray-800 font-medium">{variety.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Store className="h-5 w-5 mr-2 text-krispy-green" />
            Performance des Magasins
          </h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Production Totale</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Production</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Déchets</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {storePerformance.map(store => {
                  const productionPercent = Math.round((store.production / totalProduction) * 100);
                  const storeCost = store.production * costPerDonut;
                  
                  return (
                    <tr key={store.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {store.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {store.production.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {productionPercent}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {store.waste}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        CHF {storeCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-krispy-green" />
            Prévisions IA de Production
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Prévisions pour Demain</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded border border-gray-200">
                <p className="text-sm text-gray-500">Production Prévue</p>
                <p className="text-lg font-semibold">352 doughnuts</p>
              </div>
              <div className="bg-white p-3 rounded border border-gray-200">
                <p className="text-sm text-gray-500">Impact Météo</p>
                <p className="text-lg font-semibold">+5% (Ensoleillé)</p>
              </div>
              <div className="bg-white p-3 rounded border border-gray-200">
                <p className="text-sm text-gray-500">Impact Événements</p>
                <p className="text-lg font-semibold">+10% (Festival Local)</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Facteurs de Production</h3>
            
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Jour de la Semaine (Vendredi)</span>
                  <span className="text-sm text-gray-600">+15%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-krispy-green h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Météo (Ensoleillé)</span>
                  <span className="text-sm text-gray-600">+5%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-krispy-green h-2 rounded-full" style={{ width: '55%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Festival Local</span>
                  <span className="text-sm text-gray-600">+10%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-krispy-green h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Tendance Historique</span>
                  <span className="text-sm text-gray-600">+3%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-krispy-green h-2 rounded-full" style={{ width: '53%' }}></div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Recommandation IA :</span> Augmenter la production de 33% demain en raison des ventes du vendredi, des prévisions météo favorables et du festival local. Se concentrer sur Original Glazed (40%) et les variétés au Chocolat (25%).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;