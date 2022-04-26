package filecache

import (
	"github.com/wailsapp/mimetype"
	"sync"
)

type CacheEntry struct {
	Data     []byte
	Mimetype *mimetype.MIME
}

var (
	store = make(map[string]*CacheEntry)
	lock  sync.RWMutex
)

func Set(key string, data []byte) {
	lock.Lock()
	store[key] = &CacheEntry{
		Data:     data,
		Mimetype: mimetype.Detect(data),
	}
	lock.Unlock()
}

func Get(key string) *CacheEntry {
	lock.Lock()
	result := store[key]
	lock.Unlock()
	return result
}

func Delete(key string) {
	lock.Lock()
	store[key] = nil
	lock.Unlock()
}
