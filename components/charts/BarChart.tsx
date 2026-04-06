import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartProps {
  data: ChartData<'bar'>;
  title: string;
}

const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    elements: {
      bar: {
        borderRadius: 4,
        borderSkipped: false,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false, // The title is handled by CardTitle in parent
      },
      tooltip: {
        backgroundColor: '#0f172a', // slate-900
        titleFont: {
            size: 14,
            weight: 'bold',
        },
        bodyFont: {
            size: 12,
        },
        padding: 10,
        cornerRadius: 4,
        displayColors: false,
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.x !== null) {
                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.x);
                }
                return label;
            }
        }
      }
    },
    scales: {
        x: {
            beginAtZero: true,
            grid: {
                color: '#f1f5f9' // slate-100
            },
            ticks: {
                color: '#64748b', // slate-500
                font: {
                    size: 12,
                },
                callback: function(value) {
                    if (typeof value === 'number') {
                        if (value >= 1000) {
                            return 'R$' + (value / 1000) + 'k';
                        }
                        return 'R$' + value;
                    }
                    return value;
                }
            }
        },
        y: {
             grid: {
                display: false
            },
            ticks: {
                 color: '#334155', // slate-700
                 font: {
                    size: 12,
                    weight: '500',
                 }
            }
        }
    }
  };

  return <div className="h-72 w-full"><Bar options={options} data={data} /></div>;
};

export default BarChart;
