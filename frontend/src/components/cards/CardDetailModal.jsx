import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, ExternalLink, Cpu, HardDrive, Server, Container, Shield, Globe,
  Lightbulb, ToggleRight, Gauge, PlayCircle, PauseCircle, Layers, 
  Clock as ClockIcon, Activity, Database, FileJson, RefreshCw, Network,
  Settings, Users, Zap, AlertCircle, ThermometerSun, Droplets, Wind, Bookmark
} from 'lucide-react';
import { serviceIcons } from '../../constants/icons';

function CardDetailModal({ card, data, onClose }) {
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);
  const IconComponent = serviceIcons[card.icon] || serviceIcons.default;

  const handleOverlayMouseDown = (e) => { mouseDownTarget.current = e.target; };
  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) onClose();
    mouseDownTarget.current = null;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}д ${hours}ч`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-[400] p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={handleOverlayMouseDown} onMouseUp={handleOverlayMouseUp}
    >
      <motion.div
        className="glass-card w-full max-w-2xl my-auto"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {card.customIcon ? (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/10">
                  <img src={card.customIcon} alt="" className="w-10 h-10 object-contain drop-shadow-md" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                  style={{ backgroundColor: `${card.color}25`, color: card.color }}>
                  <div className="w-10 h-10"><IconComponent /></div>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-semibold text-white">{card.name}</h2>
                <p className="text-dark-400">{card.description}</p>
                {card.url && (
                  <a href={card.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                    <ExternalLink size={12} /> {card.url}
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content based on integration type */}
          {data && !data.error && (
            <div className="space-y-6">
              {/* Integration section - только если настроена */}
              {data.configured && (
                <>
                  {card.integration?.type && (
                    <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Интеграция</h3>
                  )}
                  
                  {/* Proxmox Details */}
                  {card.integration?.type === 'proxmox' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-4 text-center">
                      <Server size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.vms?.running || 0}/{data.vms?.total || 0}</div>
                      <div className="text-dark-500 text-sm">Virtual Machines</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Container size={24} className="text-cyan-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.containers?.running || 0}/{data.containers?.total || 0}</div>
                      <div className="text-dark-500 text-sm">LXC Containers</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <ClockIcon size={24} className="text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{formatUptime(data.uptime)}</div>
                      <div className="text-dark-500 text-sm">Uptime</div>
                    </div>
                  </div>

                  {data.storage?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">Storage</h3>
                      <div className="space-y-2">
                        {data.storage.map((s, i) => (
                          <div key={i} className="glass-card p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-dark-300">{s.name}</span>
                              <span className="text-dark-500 text-sm">{s.type}</span>
                            </div>
                            <div className="progress-bar h-2">
                              <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" style={{ width: `${s.percent}%` }} />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-dark-500">
                              <span>{formatBytes(s.used)}</span>
                              <span>{s.percent}%</span>
                              <span>{formatBytes(s.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MikroTik Details */}
              {card.integration?.type === 'mikrotik' && (
                <>
                  <div className="glass-card p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{data.boardName}</div>
                        <div className="text-sm text-dark-400">RouterOS {data.version}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-dark-400">Uptime</div>
                        <div className="text-lg font-medium text-green-400">{data.uptime?.formatted || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU ({data.cpuCount} cores)</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {data.hdd && (
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive size={16} className="text-orange-400" />
                          <span className="text-dark-400">Storage</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{data.hdd.percent}%</div>
                        <div className="text-sm text-dark-500 mt-1">{formatBytes(data.hdd.used)} / {formatBytes(data.hdd.total)}</div>
                        <div className="progress-bar mt-2 h-2">
                          <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" style={{ width: `${data.hdd.percent}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Network size={16} className="text-green-400" />
                        <span className="text-dark-400">Interfaces</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        <span className="text-green-400">{data.interfaces?.up}</span>
                        <span className="text-dark-500"> / {data.interfaces?.total}</span>
                      </div>
                      <div className="text-sm text-dark-500 mt-1">active</div>
                    </div>
                  </div>

                  {data.architecture && (
                    <div className="mt-4 text-center text-sm text-dark-500">
                      Architecture: {data.architecture}
                    </div>
                  )}
                </>
              )}

              {/* AdGuard Details */}
              {card.integration?.type === 'adguard' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 text-center">
                    <Globe size={24} className="text-blue-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-white">{data.totalQueries?.toLocaleString()}</div>
                    <div className="text-dark-500 text-sm">Total Queries</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Shield size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-400">{data.blockedQueries?.toLocaleString()}</div>
                    <div className="text-dark-500 text-sm">Blocked ({data.blockPercent}%)</div>
                  </div>
                </div>
              )}

              {/* CrowdSec Details */}
              {card.integration?.type === 'crowdsec' && (
                <>
                  <div className="glass-card p-4 text-center mb-4">
                    <Shield size={24} className="text-red-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-red-400">{data.blockedIPs?.toLocaleString() || 0}</div>
                    <div className="text-dark-500 text-sm">Blocked IPs</div>
                  </div>

                  {data.decisionTypes && Object.keys(data.decisionTypes).length > 0 && (
                    <div className="glass-card p-4 mb-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Decision Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.decisionTypes).map(([type, count]) => (
                          <div key={type} className="px-3 py-1.5 bg-dark-700 rounded-lg text-sm">
                            <span className="text-dark-400">{type}:</span>
                            <span className="ml-1 font-medium text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.topScenarios && data.topScenarios.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Top Scenarios</h3>
                      <div className="space-y-2">
                        {data.topScenarios.map((scenario, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-dark-300 truncate flex-1">{scenario.name}</span>
                            <span className="text-sm font-medium text-white ml-2">{scenario.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* OpenWRT Details */}
              {card.integration?.type === 'openwrt' && (
                <>
                  <div className="glass-card p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{data.boardName || 'OpenWRT'}</div>
                        <div className="text-sm text-dark-400">{data.version}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-dark-400">Uptime</div>
                        <div className="text-lg font-medium text-green-400">{data.uptime?.formatted || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>

                  {(data.hostname || data.kernel) && (
                    <div className="mt-4 glass-card p-4">
                      {data.hostname && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-dark-400">Hostname</span>
                          <span className="text-white">{data.hostname}</span>
                        </div>
                      )}
                      {data.kernel && (
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-dark-400">Kernel</span>
                          <span className="text-white">{data.kernel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Weather Details */}
              {card.integration?.type === 'weather' && (
                <div className="text-center py-4">
                  <div className="text-6xl mb-4">{data.icon}</div>
                  <div className="text-5xl font-bold text-white mb-2">{data.temp}°C</div>
                  <div className="text-xl text-dark-400 capitalize mb-4">{data.description}</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-3 text-center">
                      <ThermometerSun size={20} className="text-orange-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.feelsLike}°C</div>
                      <div className="text-xs text-dark-500">Feels like</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <Droplets size={20} className="text-blue-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.humidity}%</div>
                      <div className="text-xs text-dark-500">Humidity</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <Wind size={20} className="text-gray-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.wind} м/с</div>
                      <div className="text-xs text-dark-500">Wind</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Home Assistant Details */}
              {card.integration?.type === 'homeassistant' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="glass-card p-4 text-center">
                      <Lightbulb size={24} className="text-yellow-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-400">{data.entityCounts?.lightsOn || 0}</div>
                      <div className="text-sm text-dark-500">из {data.entityCounts?.lights || 0} вкл.</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <ToggleRight size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-400">{data.entityCounts?.switchesOn || 0}</div>
                      <div className="text-sm text-dark-500">из {data.entityCounts?.switches || 0} вкл.</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Gauge size={24} className="text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.entityCounts?.sensors || 0}</div>
                      <div className="text-dark-500 text-sm">Датчики</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Zap size={24} className="text-orange-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.entityCounts?.automations || 0}</div>
                      <div className="text-dark-500 text-sm">Автоматизации</div>
                    </div>
                  </div>
                  
                  {/* Custom Entities */}
                  {data.customEntities && data.customEntities.length > 0 && (
                    <div className="glass-card p-4">
                      <h4 className="text-sm font-medium text-dark-400 mb-3">Отслеживаемые сущности</h4>
                      <div className="space-y-2">
                        {data.customEntities.map((entity, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg">
                            <span className="text-dark-300">{entity.name}</span>
                            <span className={`font-medium px-2 py-0.5 rounded ${
                              entity.state === 'on' ? 'bg-yellow-500/20 text-yellow-400' : 
                              entity.state === 'off' ? 'bg-dark-700 text-dark-500' : 
                              entity.domain === 'sensor' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white'
                            }`}>
                              {entity.state}{entity.unit ? ` ${entity.unit}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wiki.js Details */}
              {card.integration?.type === 'wikijs' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card p-4 text-center">
                    <FileJson size={24} className="text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{data.totalPages}</div>
                    <div className="text-dark-500 text-sm">Pages</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <RefreshCw size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-400">{data.recentPages}</div>
                    <div className="text-dark-500 text-sm">Updated (7d)</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Users size={24} className="text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{data.activeUsers}/{data.totalUsers}</div>
                    <div className="text-dark-500 text-sm">Active Users</div>
                  </div>
                </div>
              )}

              {/* NPM Plus Details */}
              {card.integration?.type === 'npm' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 text-center">
                    <Globe size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-400">{data.enabledHosts}</div>
                    <div className="text-dark-500 text-sm">Active Hosts</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Server size={24} className="text-dark-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-white">{data.totalHosts}</div>
                    <div className="text-dark-500 text-sm">Total Hosts</div>
                  </div>
                </div>
              )}
                </>
              )}

              {/* Monitoring Details */}
              {data?.monitoringStatus && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Мониторинг</h3>
                  {/* Current Status */}
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-dark-400">Текущий статус</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        data.monitoringStatus.status === 'up' ? 'bg-green-500/20 text-green-400' :
                        data.monitoringStatus.status === 'down' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {data.monitoringStatus.status === 'up' ? 'Online' : 
                         data.monitoringStatus.status === 'down' ? 'Offline' : 'Degraded'}
                      </span>
                    </div>
                    {data.monitoringStatus.checks?.length > 0 && (
                      <div className="text-sm text-dark-400">
                        Последняя проверка: {new Date(data.monitoringStatus.checks[data.monitoringStatus.checks.length - 1]?.timestamp).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  {data.monitoringStatus.stats && (
                    <div className="grid grid-cols-2 gap-4">
                      {['1h', '24h', '7d', '30d'].map(period => {
                        const stats = data.monitoringStatus.stats[period];
                        if (!stats) return null;
                        return (
                          <div key={period} className="glass-card p-4 text-center">
                            <div className="text-dark-500 text-sm mb-1">Uptime {period}</div>
                            <div className={`text-2xl font-bold ${
                              parseFloat(stats.uptime) >= 99 ? 'text-green-400' :
                              parseFloat(stats.uptime) >= 95 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {stats.uptime}%
                            </div>
                            {stats.avgResponseTime && (
                              <div className="text-xs text-dark-500 mt-1">~{stats.avgResponseTime}ms</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Checks */}
                  {data.monitoringStatus.checks?.length > 0 && (
                    <div className="glass-card p-4">
                      <h4 className="text-sm text-dark-400 mb-3">Последние проверки</h4>
                      <div className="flex gap-1">
                        {data.monitoringStatus.checks.slice(-50).map((check, i) => (
                          <div 
                            key={i}
                            className={`w-2 h-6 rounded-sm ${
                              check.status === 'up' ? 'bg-green-500' :
                              check.status === 'down' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}
                            title={`${new Date(check.timestamp).toLocaleTimeString('ru-RU')} - ${check.status} ${check.responseTime ? `(${check.responseTime}ms)` : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Billing Details */}
              {data?.billing && data.billing.nextPayment && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Платеж</h3>
                  {/* Payment Info */}
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-dark-400">Следующий платеж</span>
                      <span className="text-xl font-bold text-white">
                        {data.billing.amount} {data.billing.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-400">Дата</span>
                      <span className="text-white">{data.billing.nextPayment}</span>
                    </div>
                    {data.billing.period && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-dark-400">Период</span>
                        <span className="text-white">
                          {data.billing.period === 'monthly' ? 'Ежемесячно' :
                           data.billing.period === 'quarterly' ? 'Ежеквартально' :
                           data.billing.period === 'yearly' ? 'Ежегодно' : 'Разово'}
                        </span>
                      </div>
                    )}
                    {data.billing.note && (
                      <div className="mt-4 pt-4 border-t border-dark-700">
                        <span className="text-dark-500 text-sm">{data.billing.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Days until payment */}
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const paymentDate = new Date(data.billing.nextPayment);
                    paymentDate.setHours(0, 0, 0, 0);
                    const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div className={`glass-card p-4 text-center ${
                        daysUntil <= 0 ? 'bg-red-500/10' :
                        daysUntil <= 3 ? 'bg-yellow-500/10' :
                        daysUntil <= 7 ? 'bg-blue-500/10' : ''
                      }`}>
                        <div className={`text-4xl font-bold ${
                          daysUntil <= 0 ? 'text-red-400' :
                          daysUntil <= 3 ? 'text-yellow-400' :
                          daysUntil <= 7 ? 'text-blue-400' : 'text-white'
                        }`}>
                          {daysUntil < 0 ? `+${Math.abs(daysUntil)}` : daysUntil}
                        </div>
                        <div className="text-dark-400 text-sm mt-1">
                          {daysUntil < 0 ? 'дней просрочено' :
                           daysUntil === 0 ? 'платеж сегодня' :
                           daysUntil === 1 ? 'день до платежа' :
                           'дней до платежа'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SSH Host Details */}
              {card.integration?.type === 'ssh' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-orange-400" />
                        <span className="text-dark-400">Load Average</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.load?.load1}</div>
                      <div className="text-sm text-dark-500 mt-1">
                        5m: {data.load?.load5} | 15m: {data.load?.load15}
                      </div>
                      <div className="text-xs text-dark-600 mt-1">{data.load?.cores} cores</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" 
                          style={{ width: `${Math.min(parseFloat(data.load?.percent || 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-blue-400" />
                        <span className="text-dark-400">Memory</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">
                        {formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}
                      </div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" 
                          style={{ width: `${data.memory?.percent || 0}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database size={16} className="text-purple-400" />
                        <span className="text-dark-400">Disk Usage</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.disk?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">
                        {formatBytes(data.disk?.used)} / {formatBytes(data.disk?.total)}
                      </div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" 
                          style={{ width: `${data.disk?.percent || 0}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4 text-center flex flex-col items-center justify-center">
                      <ClockIcon size={24} className="text-green-400 mb-2" />
                      <div className="text-2xl font-bold text-white">{data.uptime?.formatted}</div>
                      <div className="text-dark-500 text-sm">Uptime</div>
                    </div>
                  </div>
                </>
              )}

              {/* Docker Details */}
              {card.integration?.type === 'docker' && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="glass-card p-4 text-center">
                      <PlayCircle size={24} className="text-green-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-green-400">{data.running}</div>
                      <div className="text-dark-500 text-sm">Running</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <PauseCircle size={24} className="text-gray-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-gray-400">{data.stopped}</div>
                      <div className="text-dark-500 text-sm">Stopped</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Container size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-white">{data.total}</div>
                      <div className="text-dark-500 text-sm">Total</div>
                    </div>
                  </div>

                  {data.containers && data.containers.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Containers</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {data.containers.map((c, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-dark-700/50 rounded-lg">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-white truncate">{c.name}</div>
                              <div className="text-xs text-dark-500 truncate">{c.image}</div>
                            </div>
                            <div className="text-xs text-dark-500 flex-shrink-0">{c.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Portainer Details */}
              {card.integration?.type === 'portainer' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    <div className="glass-card p-3 sm:p-4 text-center">
                      <PlayCircle size={20} className="text-green-400 mx-auto mb-1 sm:mb-2 sm:w-6 sm:h-6" />
                      <div className="text-2xl sm:text-3xl font-bold text-green-400">{data.running}</div>
                      <div className="text-dark-500 text-xs sm:text-sm">Running</div>
                    </div>
                    <div className="glass-card p-3 sm:p-4 text-center">
                      <PauseCircle size={20} className="text-gray-500 mx-auto mb-1 sm:mb-2 sm:w-6 sm:h-6" />
                      <div className="text-2xl sm:text-3xl font-bold text-gray-400">{data.stopped}</div>
                      <div className="text-dark-500 text-xs sm:text-sm">Stopped</div>
                    </div>
                    <div className="glass-card p-3 sm:p-4 text-center">
                      <Layers size={20} className="text-blue-400 mx-auto mb-1 sm:mb-2 sm:w-6 sm:h-6" />
                      <div className="text-2xl sm:text-3xl font-bold text-blue-400">{data.stacks || 0}</div>
                      <div className="text-dark-500 text-xs sm:text-sm">Stacks</div>
                    </div>
                    <div className="glass-card p-3 sm:p-4 text-center">
                      <Server size={20} className="text-purple-400 mx-auto mb-1 sm:mb-2 sm:w-6 sm:h-6" />
                      <div className="text-2xl sm:text-3xl font-bold text-purple-400">{data.totalEndpoints || 0}</div>
                      <div className="text-dark-500 text-xs sm:text-sm">Envs</div>
                    </div>
                  </div>

                  {/* Endpoints/Environments */}
                  {data.endpoints && data.endpoints.length > 0 && (
                    <div className="glass-card p-3 sm:p-4 mb-3 sm:mb-4">
                      <h3 className="text-xs sm:text-sm font-medium text-dark-400 mb-2 sm:mb-3">Environments</h3>
                      <div className="space-y-2">
                        {data.endpoints.map((ep, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className={`w-2 h-2 rounded-full ${ep.status === 'up' ? 'bg-green-400' : 'bg-red-400'}`} />
                              <div>
                                <div className="font-medium text-xs sm:text-sm text-white">{ep.name}</div>
                                <div className="text-[10px] sm:text-xs text-dark-500">{ep.type}</div>
                              </div>
                            </div>
                            <div className="text-xs sm:text-sm">
                              <span className="text-green-400">{ep.running}</span>
                              <span className="text-dark-500">/{ep.containers}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Containers */}
                  {data.containers && data.containers.length > 0 && (
                    <div className="glass-card p-3 sm:p-4">
                      <h3 className="text-xs sm:text-sm font-medium text-dark-400 mb-2 sm:mb-3">Containers</h3>
                      <div className="space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                        {data.containers.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 bg-dark-700/50 rounded-lg">
                            <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs sm:text-sm text-white truncate">{c.name}</div>
                              <div className="text-[10px] sm:text-xs text-dark-500 truncate">{c.image}</div>
                            </div>
                            <div className="text-[10px] sm:text-xs text-dark-500 flex-shrink-0">{c.endpoint}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error state */}
          {data?.error && (
            <div className="text-center py-8">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
              <p className="text-red-400">{data.error}</p>
            </div>
          )}

          {/* Not configured - показываем только если интеграция есть но не настроена, и нет мониторинга/биллинга */}
          {card.integration?.type && data && !data.configured && !data.monitoringStatus && !data.billing && (
            <div className="text-center py-8">
              <Settings size={48} className="text-dark-500 mx-auto mb-4" />
              <p className="text-dark-400">Интеграция не настроена</p>
            </div>
          )}

          {/* Bookmarks Section */}
          {card.bookmarks?.length > 0 && (
            <div className="mt-6 pt-6 border-t border-dark-700">
              <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Bookmark size={16} />
                Закладки ({card.bookmarks.length})
              </h3>
              <div className="space-y-2">
                {card.bookmarks.map(bookmark => (
                  <a
                    key={bookmark.id}
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                      <Bookmark size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                        {bookmark.name}
                      </div>
                      {bookmark.description && (
                        <div className="text-sm text-dark-400 truncate">{bookmark.description}</div>
                      )}
                    </div>
                    <ExternalLink size={16} className="text-dark-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-dark-700">
            {card.url && (
              <a href={card.url} target="_blank" rel="noopener noreferrer"
                className="btn btn-primary flex items-center gap-2">
                <ExternalLink size={16} /> Открыть
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Service Card Component ============
// ============ Service Card Component ============
export default CardDetailModal;
