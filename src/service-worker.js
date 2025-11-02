const swFolder = location.pathname.replace(/[^\/]+\.js$/, "")
const indexUrl = location.origin + swFolder
const urlRoot = location.origin + "/"
const CACHE_NAME = "offline"

let devLog = ()=>{}
if (indexUrl.includes("localhost")){
	devLog = console.log
}


self.addEventListener("install", function(ev){
	devLog("begin install", ev, location)
    ev.waitUntil(
		Promise.all([
			self.skipWaiting(),
			intelegentFetch(indexUrl)
		])
    )
})

self.addEventListener("activate", function(ev){
    devLog("activate", ev)
    ev.waitUntil(
        clients.claim()
    )
})

self.addEventListener("fetch", function(ev){
    devLog("fetch", ev)
    ev.respondWith(intelegentFetch(ev.request))
})

function wait(ms){
	return new Promise(accept=>setTimeout(accept, ms))
}

class LinkedList{
	constructor(){
		this.start = undefined
		this.end = undefined
		this.length = 0
	}
	get first(){
		return this.start
	}
	get last(){
		return this.end
	}
	set first(value){
		return this.start = value
	}
	set last(value){
		return this.end = value
	}
	add(item){
		const actualItem = createLinkedItem(this, item)

		if (!this.start){
			this.start = actualItem
		}
		if (!this.end){
			this.end = actualItem
		}
		else{
			actualItem.prev = this.end
			this.end.next = actualItem
			this.end = actualItem
		}
		this.length++
		return actualItem
	}
}

function createLinkedItem(homelist, data = {}){
	let item
	if (typeof data !== "object"){
		item = Object.create({data})
	}
	else{
		item = Object.create(data)
	}
	
	item.next = undefined
	item.prev = undefined

	item.get = function(propName){
		return data[propName]
	}

	item.drop = function(){
		if (item.next){
			item.next.prev = item.prev
		}

		if (item.prev){
			item.prev.next = item.next
		}

		if (homelist.start === item){
			homelist.start = item.next
		}

		if (homelist.end === item){
			homelist.end = item.prev
		}

		homelist.length--
	}
	return item
}

const currentlyOngoingCalls = new LinkedList()
async function intelegentFetch(req, justUseTheCache = false){
	let requestedPath = req.url || req
	if (requestedPath.includes("://") && !requestedPath.startsWith("http")){
		return fetch(req)
	}

	let cachedAsset

	const storage = await caches.open(CACHE_NAME)

	if (justUseTheCache){
		cachedAsset = await storage.match(req)
		if (cachedAsset){
			return cachedAsset
		}
	}

	let cachedContents
	if (cachedAsset = await storage.match(req)){
		let cachedEtag = cachedAsset.headers.get("etag")
		let cachedLastMod = cachedAsset.headers.get("last-modified")
		let cachedDate = cachedAsset.headers.get("Date")
		cachedContents = await cachedAsset.clone().text()

		if (cachedContents){
			let headResponse, attempts = 0, maxAttempts = 2
			// we get 3 tries to get the headers. if we dont then we assume the server's dead and just serve up the cache
			
			devLog(`Execution for ${requestedPath}: Start HEAD loop`)

			while (!headResponse && attempts < maxAttempts){
				attempts++
				let waitMs = attempts * 200
				try{
					devLog(`HEAD ${requestedPath}: there are currently ${currentlyOngoingCalls.length} other ongoing other fetches`)
					let fetchAttempt = fetch(req, {
						method: "HEAD",
					})
					let fetchLink = currentlyOngoingCalls.add(fetchAttempt)
					headResponse = await fetchAttempt
					fetchLink.drop()
				}
				catch(uwu){
					devLog(`Execution for ${requestedPath}: Exit HEAD on error`)
					headResponse = undefined
					return cachedAsset // error means that the network is down so we just go with the cache
				}
				
				if (!headResponse.ok || headResponse.status >= 300 || headResponse.status < 200){
					devLog(`Execution for ${requestedPath}: Retry HEAD on bad status`)
					headResponse = undefined
					await wait(waitMs)
					continue
				}
	
				if (headResponse && headResponse.headers){
					if (cachedEtag && headResponse.headers.get("etag") === cachedEtag){
						devLog(`Execution for ${requestedPath}: Exit HEAD on etag equivilance`)
						return cachedAsset
					}
					if (cachedLastMod && headResponse.headers.get("last-modified") === cachedLastMod){
						devLog(`Execution for ${requestedPath}: Exit HEAD on last-modified equivilance`)
						return cachedAsset
					}
					if (cachedDate && headResponse.headers.get("Date") === cachedDate){
						devLog(`Execution for ${requestedPath}: Exit HEAD on Date equivilance`)
						return cachedAsset
					}
					devLog(`Execution for ${requestedPath}: HEAD Header Data:`, {
						etag: headResponse.headers.get("etag"),
						"last-modified": headResponse.headers.get("last-modified"),
						"date": headResponse.headers.get("date"),
					})
					headResponse.headers.forEach((val, key)=>{
						devLog(`Execution for ${requestedPath}: HEAD Header ${key}: ${val}`)
					})
				}
				else{
					devLog(`Execution for ${requestedPath}: Retry HEAD on lack of header response`)
				}
			}

			devLog(`Execution for ${requestedPath}: End HEAD loop.`, {
				cachedEtag,
				cachedLastMod,
				cachedDate
			})


			if (attempts >= maxAttempts){
				// the only way this is true is if the remote server failed. at this point, we just use the cache.
				devLog(`Execution for ${requestedPath}: Exit HEAD on max-attempt reached`, {attempts, maxAttempts})
				return cachedAsset
			}

			devLog(`Execution for ${requestedPath}: Passed attempts check`)
		}
		devLog("asset needs refreshing", req)
	}

	// the only way we get here is if the remote server is working and we need to update our cache or we dont actually have anything cached and we need to get it from the server.

	let fetchedAsset, fetchAttempts = 0, fetchMaxAttempts = 3
	while(!fetchedAsset && fetchAttempts < fetchMaxAttempts){
		fetchAttempts++
		let waitMs = fetchAttempts * 200
		try{
			devLog(`GET ${requestedPath}: there are currently ${currentlyOngoingCalls.length} other ongoing other fetches`)
			let fetchAttempt = fetch(req)
			let fetchLink = currentlyOngoingCalls.add(fetchAttempt)
			fetchedAsset = await fetchAttempt
			fetchLink.drop()
		} 
		catch(err){
			fetchedAsset = undefined
			await wait(waitMs)
			continue
		}
		
		if (!fetchedAsset.ok || fetchedAsset.status >= 300 || fetchedAsset.status < 200){
			fetchedAsset = undefined
			await wait(waitMs)
			continue
		}

		let resContent = await fetchedAsset.clone().text()

		if (!resContent){
			fetchedAsset = undefined
			await wait(waitMs)
			continue
		}

		await storage.put(req, fetchedAsset.clone())
		return fetchedAsset
	}
	// alright we've had our attempt at getting the app from the server. if we still haven't gotten anything back at this point, the server's rejecting us and we can only throw an error back at the user.
	return fetchedAsset || cachedAsset
}