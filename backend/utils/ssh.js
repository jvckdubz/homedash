const { Client: SSHClient } = require('ssh2');

// SSH Helper - execute command and return result
const sshExec = (config, command, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = '';
    let errorOutput = '';
    
    const timeoutId = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout'));
    }, timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          conn.end();
          return reject(err);
        }
        
        stream.on('close', (code) => {
          clearTimeout(timeoutId);
          conn.end();
          if (code === 0 || output) {
            resolve(output.trim());
          } else {
            reject(new Error(errorOutput || `Command failed with code ${code}`));
          }
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    }).connect(config);
  });
};

// SSH Helper - get system stats with a single connection
const getSSHStats = async (sshConfig) => {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const stats = {};
    let commandsCompleted = 0;
    const totalCommands = 5;
    
    const commands = {
      uptime: "cat /proc/uptime | awk '{print $1}'",
      loadavg: "cat /proc/loadavg",
      memory: "cat /proc/meminfo | grep -E '^(MemTotal|MemAvailable|MemFree|Buffers|Cached):' | awk '{print $1, $2}'",
      disk: "df -B1 / | tail -1 | awk '{print $2, $3, $4, $5}'",
      cpu: "grep -c ^processor /proc/cpuinfo && head -1 /proc/stat"
    };

    const timeoutId = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout'));
    }, 15000);

    conn.on('ready', () => {
      // Execute all commands
      Object.entries(commands).forEach(([key, cmd]) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            stats[key] = null;
            commandsCompleted++;
            if (commandsCompleted === totalCommands) {
              clearTimeout(timeoutId);
              conn.end();
              resolve(stats);
            }
            return;
          }

          let output = '';
          stream.on('close', () => {
            stats[key] = output.trim();
            commandsCompleted++;
            if (commandsCompleted === totalCommands) {
              clearTimeout(timeoutId);
              conn.end();
              resolve(stats);
            }
          }).on('data', (data) => {
            output += data.toString();
          });
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    }).connect(sshConfig);
  });
};

// Parse SSH stats from raw output
const parseSSHStats = (rawStats) => {
  const result = {
    configured: true,
    error: null
  };

  // Uptime
  if (rawStats.uptime) {
    const uptimeSeconds = parseFloat(rawStats.uptime);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    result.uptime = {
      seconds: Math.floor(uptimeSeconds),
      formatted: days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`
    };
  }

  // Load average
  if (rawStats.loadavg) {
    const parts = rawStats.loadavg.split(' ');
    result.load = {
      load1: parseFloat(parts[0]).toFixed(2),
      load5: parseFloat(parts[1]).toFixed(2),
      load15: parseFloat(parts[2]).toFixed(2)
    };
  }

  // Memory
  if (rawStats.memory) {
    const memInfo = {};
    rawStats.memory.split('\n').forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0].replace(':', '');
        memInfo[key] = parseInt(parts[1]) * 1024; // Convert kB to bytes
      }
    });

    const total = memInfo.MemTotal || 0;
    const available = memInfo.MemAvailable || memInfo.MemFree || 0;
    const used = total - available;

    result.memory = {
      total,
      used,
      available,
      percent: total > 0 ? ((used / total) * 100).toFixed(1) : 0
    };
  }

  // Disk
  if (rawStats.disk) {
    const parts = rawStats.disk.split(/\s+/);
    if (parts.length >= 4) {
      const total = parseInt(parts[0]);
      const used = parseInt(parts[1]);
      result.disk = {
        total,
        used,
        available: parseInt(parts[2]),
        percent: parts[3].replace('%', '')
      };
    }
  }

  // CPU cores (for load percentage calculation)
  if (rawStats.cpu) {
    const lines = rawStats.cpu.split('\n');
    result.cpuCores = parseInt(lines[0]) || 1;
    if (result.load) {
      // Calculate load percent based on 1-minute load and CPU cores
      result.load.percent = ((parseFloat(result.load.load1) / result.cpuCores) * 100).toFixed(1);
    }
  }

  return result;
};

module.exports = {
  sshExec,
  getSSHStats,
  parseSSHStats
};
