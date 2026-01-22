import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, RefreshCw, Container, Activity, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api';

function SystemInfoSection() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const loadInfo = async () => {
    try {
      const [version, docker, monitoring] = await Promise.all([
        api.get('/api/system/version').catch(() => null),
        api.get('/api/system/docker').catch(() => ({ available: false })),
        api.get('/api/monitoring/status').catch(() => ({}))
      ]);
      
      const monitoredCount = Object.keys(monitoring).length;
      const upCount = Object.values(monitoring).filter(m => m.status === 'up').length;
      
      setSystemInfo({
        version: version?.version || 'N/A',
        isProduction: version?.isProduction || false,
        nodeVersion: version?.nodeVersion,
        docker,
        monitoring: { total: monitoredCount, up: upCount }
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const data = await api.get('/api/system/check-update');
      setUpdateInfo(data);
    } catch (err) {
      console.error('Failed to check update:', err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    loadInfo();
    checkUpdate();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <motion.div 
          className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  const getUpdateCommand = () => {
    const docker = systemInfo?.docker;
    
    if (!docker?.available || !docker?.containerFound) {
      return {
        method: 'unknown',
        commands: ['# Docker не обнаружен']
      };
    }

    if (docker.launchMethod === 'compose') {
      const workdir = docker.composeWorkdir || '/opt/homedash';
      return {
        method: 'compose',
        label: 'Docker Compose',
        commands: [
          `cd ${workdir}`,
          'git pull  # или скачайте новую версию',
          'docker compose down',
          'docker compose up -d --build'
        ]
      };
    } else {
      const containerName = docker.containerName || 'homedash';
      return {
        method: 'run',
        label: 'Docker Run',
        commands: [
          `docker stop ${containerName}`,
          `docker rm ${containerName}`,
          'docker pull jvckdubz/homedash:latest',
          `docker run -d --name ${containerName} \\`,
          '  -p 3000:3000 \\',
          '  -v /var/run/docker.sock:/var/run/docker.sock \\',
          '  -v homedash-data:/app/data \\',
          '  jvckdubz/homedash:latest'
        ]
      };
    }
  };

  const updateCmd = getUpdateCommand();

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Server size={18} className="text-blue-400" />
          HomeDash
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Версия</div>
            <div className="text-lg font-semibold text-blue-400">v{systemInfo?.version}</div>
          </div>
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Режим</div>
            <div className="text-lg font-semibold">
              {systemInfo?.isProduction ? (
                <span className="text-green-400">Production</span>
              ) : (
                <span className="text-yellow-400">Development</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Check */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <RefreshCw size={18} className={`text-yellow-400 ${checkingUpdate ? 'animate-spin' : ''}`} />
            Обновление
          </h3>
          <button
            onClick={checkUpdate}
            disabled={checkingUpdate}
            className="text-xs px-2 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Проверить
          </button>
        </div>

        {updateInfo && (
          <div className="mb-4">
            {updateInfo.hasUpdate ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertCircle size={18} />
                  <span className="font-medium">Доступна новая версия!</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-300">
                    v{updateInfo.currentVersion} → <span className="text-green-400 font-medium">v{updateInfo.latestVersion}</span>
                  </span>
                  {updateInfo.releaseUrl && (
                    <a
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <span>GitHub</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                {updateInfo.releaseNotes && (
                  <div className="mt-2 text-xs text-dark-400 line-clamp-2">
                    {updateInfo.releaseNotes}
                  </div>
                )}
              </div>
            ) : updateInfo.latestVersion ? (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={18} />
                  <span>Установлена актуальная версия v{updateInfo.currentVersion}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-dark-700/50 rounded-lg text-dark-400 text-sm">
                Не удалось проверить обновления
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {systemInfo?.docker?.available && systemInfo?.docker?.containerFound && (
            <div className="flex items-center gap-2 text-sm">
              <Container size={16} className="text-purple-400" />
              <span className="text-dark-400">Способ запуска:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                updateCmd.method === 'compose' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {updateCmd.label}
              </span>
            </div>
          )}

          <div className="text-sm text-dark-400">Команды для обновления:</div>
          <div className="p-3 bg-dark-900 rounded-lg font-mono text-xs text-dark-300 space-y-1 overflow-x-auto">
            {updateCmd.commands.map((cmd, i) => (
              <div key={i} className={cmd.startsWith('#') ? 'text-dark-500' : ''}>
                {cmd}
              </div>
            ))}
          </div>
          
          <p className="text-dark-500 text-xs">
            Данные (карточки, настройки) сохраняются в volume и не удаляются при обновлении.
          </p>
        </div>
      </div>

      {/* Monitoring Stats */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Activity size={18} className="text-green-400" />
          Мониторинг
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Сервисов</div>
            <div className="text-lg font-semibold">{systemInfo?.monitoring?.total || 0}</div>
          </div>
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Online</div>
            <div className="text-lg font-semibold text-green-400">{systemInfo?.monitoring?.up || 0}</div>
          </div>
        </div>
      </div>

      {/* Docker Info (simplified) */}
      {systemInfo?.docker?.available && systemInfo?.docker?.containerFound && (
        <div className="p-4 bg-dark-800 rounded-xl">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Container size={18} className="text-purple-400" />
            Docker
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-400">Контейнер</span>
              <span className="text-dark-300">{systemInfo.docker.containerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Docker</span>
              <span className="text-dark-300">v{systemInfo.docker.dockerVersion}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemInfoSection;
