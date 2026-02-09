/**
 * AgentGuard Billing - Database Adapter
 * Simple JSON file-based storage for MVP
 * Can be upgraded to PostgreSQL/MongoDB for production
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), '.data');

class Database {
  constructor() {
    this.subscriptionsPath = path.join(DB_PATH, 'subscriptions.json');
    this.teamsPath = path.join(DB_PATH, 'teams.json');
    this.usagePath = path.join(DB_PATH, 'usage.json');
    this.usersPath = path.join(DB_PATH, 'users.json');
    
    this.init();
  }

  init() {
    // Ensure data directory exists
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }

    // Initialize JSON files if they don't exist
    const files = [this.subscriptionsPath, this.teamsPath, this.usagePath, this.usersPath];
    files.forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
      }
    });
  }

  // Generic CRUD operations
  read(collection) {
    const path = this.getCollectionPath(collection);
    if (!fs.existsSync(path)) return [];
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }

  write(collection, data) {
    const path = this.getCollectionPath(collection);
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  }

  getCollectionPath(collection) {
    switch (collection) {
      case 'subscriptions': return this.subscriptionsPath;
      case 'teams': return this.teamsPath;
      case 'usage': return this.usagePath;
      case 'users': return this.usersPath;
      default: throw new Error(`Unknown collection: ${collection}`);
    }
  }

  // Subscriptions
  getSubscriptions(query = {}) {
    let data = this.read('subscriptions');
    if (query.userId) data = data.filter(s => s.userId === query.userId);
    if (query.status) data = data.filter(s => s.status === query.status);
    if (query.tier) data = data.filter(s => s.tier === query.tier);
    if (query.stripeSubscriptionId) data = data.filter(s => s.stripeSubscriptionId === query.stripeSubscriptionId);
    return data;
  }

  getSubscriptionById(id) {
    const data = this.read('subscriptions');
    return data.find(s => s.id === id);
  }

  getSubscriptionByUserId(userId) {
    const data = this.read('subscriptions');
    return data.find(s => s.userId === userId);
  }

  createSubscription(subscription) {
    const data = this.read('subscriptions');
    data.push(subscription);
    this.write('subscriptions', data);
    return subscription;
  }

  updateSubscription(id, updates) {
    const data = this.read('subscriptions');
    const index = data.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
    this.write('subscriptions', data);
    return data[index];
  }

  deleteSubscription(id) {
    const data = this.read('subscriptions');
    const filtered = data.filter(s => s.id !== id);
    this.write('subscriptions', filtered);
    return true;
  }

  // Teams
  getTeams(query = {}) {
    let data = this.read('teams');
    if (query.ownerId) data = data.filter(t => t.ownerId === query.ownerId);
    return data;
  }

  getTeamById(id) {
    const data = this.read('teams');
    return data.find(t => t.id === id);
  }

  createTeam(team) {
    const data = this.read('teams');
    data.push(team);
    this.write('teams', data);
    return team;
  }

  updateTeam(id, updates) {
    const data = this.read('teams');
    const index = data.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
    this.write('teams', data);
    return data[index];
  }

  // Usage
  getUsage(query = {}) {
    let data = this.read('usage');
    if (query.userId) data = data.filter(u => u.userId === query.userId);
    if (query.month) data = data.filter(u => u.month === query.month);
    return data;
  }

  getOrCreateMonthlyUsage(userId, teamId = null) {
    const month = new Date().toISOString().slice(0, 7);
    let data = this.read('usage');
    
    let usage = data.find(u => u.userId === userId && u.month === month);
    if (!usage) {
      const { UsageSchema } = require('./schema');
      usage = UsageSchema.create(userId, teamId);
      data.push(usage);
      this.write('usage', data);
    }
    return usage;
  }

  incrementUsage(userId, metric, amount = 1) {
    const data = this.read('usage');
    const month = new Date().toISOString().slice(0, 7);
    const index = data.findIndex(u => u.userId === userId && u.month === month);
    
    if (index !== -1) {
      data[index][metric] = (data[index][metric] || 0) + amount;
      data[index].updatedAt = new Date().toISOString();
      this.write('usage', data);
      return data[index];
    }
    return null;
  }

  // Users
  getUserById(id) {
    const data = this.read('users');
    return data.find(u => u.id === id);
  }

  getUserByEmail(email) {
    const data = this.read('users');
    return data.find(u => u.email === email);
  }

  createUser(user) {
    const data = this.read('users');
    data.push(user);
    this.write('users', data);
    return user;
  }

  updateUser(id, updates) {
    const data = this.read('users');
    const index = data.findIndex(u => u.id === id);
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
    this.write('users', data);
    return data[index];
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

module.exports = { Database, getDatabase };