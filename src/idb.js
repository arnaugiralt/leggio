const DB = 'md-reader'
const STORE = 'handles'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, op) {
  return open().then(
    db =>
      new Promise((resolve, reject) => {
        let req
        try {
          const tx = db.transaction(STORE, mode)
          req = op(tx.objectStore(STORE))
          tx.oncomplete = () => {
            db.close()
            resolve(req.result)
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        } catch (err) {
          db.close()
          reject(err)
        }
      }),
  )
}

// Pins and restore are conveniences. Without IndexedDB the app still works, so failures resolve to undefined.
export const get = key => run('readonly', store => store.get(key)).catch(() => undefined)
export const set = (key, value) => run('readwrite', store => store.put(value, key)).catch(() => undefined)
