module.exports = {
    GET_ALL_BACKENDS_PIPELINE: [
        { $match: { path: { $in: ['/', '/collections', '/processes', '/service_types', '/output_formats'] } } },
        // This would be more dynamic and is effectively the same: { $match: { path: { $regex: "^\/[a-z_]*$" } } }
        // But since the endpoints are hardcoded anyway there's no benefit, especially not when considering regex slowness.
        { $sort: { backend: 1, path: 1 } },
        { $group: {
            _id: '$backend',
            backend: { $first: '$backend' },
            backendTitle: { $first: '$backendTitle' },
            group: { $first: '$group' },
            retrieved: { $max: '$retrieved' },
            unsuccessfulCrawls: { $first: '$unsuccessfulCrawls' },
            contents: { $push: '$content' },
            paths: {$push: '$path'}
        } },
        { $addFields: {
            root: { $arrayElemAt: [ '$contents', { $indexOfArray: ['$paths', '/'] } ] },
            collections: { $let: {
                vars: { index: {$indexOfArray: ['$paths', '/collections']}},
                in: { $cond: { if: { $eq: ['$$index', -1] }, then: null, else: { $arrayElemAt: [ '$contents', '$$index' ] } } }
            } },
            processes: { $let: {
                vars: { index: {$indexOfArray: ['$paths', '/processes']}},
                in: { $cond: { if: { $eq: ['$$index', -1] }, then: null, else: { $arrayElemAt: [ '$contents', '$$index' ] } } }
            } },
            outputFormats: { $let: {
                vars: { index: {$indexOfArray: ['$paths', '/output_formats']}},
                in: { $cond: { if: { $eq: ['$$index', -1] }, then: null, else: { $arrayElemAt: [ '$contents', '$$index' ] } } }
            } },
            serviceTypes: { $let: {
                vars: { index: {$indexOfArray: ['$paths', '/service_types']}},
                in: { $cond: { if: { $eq: ['$$index', -1] }, then: null, else: { $arrayElemAt: [ '$contents', '$$index' ] } } }
            } }
        } },
        { $project: {
            backend: 1,
            backendTitle: 1,
            group: 1,
            retrieved: 1,
            unsuccessfulCrawls: 1,
            version: '$root.version',
            api_version: '$root.api_version',
            endpoints: {
                $reduce: {
                    input: {
                        $map: { input: '$root.endpoints', as: 'endpoint', in: { 
                            $map: { input: '$$endpoint.methods', as: 'method', in:{
                                $concat: ['$$method',' ','$$endpoint.path']
                            }}
                        }}
                    },
                    initialValue: [],
                    in: {
                        $concatArrays: ['$$value', '$$this']
                    }
                }
            },
            collections: '$collections.collections',
            processes: '$processes.processes',
            outputFormats: 1,
            serviceTypes: 1,
            billing: '$root.billing'
        } }
    ],
    GET_ALL_COLLECTIONS_PIPELINE: [
        { $match: { path: '/collections' } },
        { $addFields: { 'content.collections.backend': '$backend', 'content.collections.backendTitle': '$backendTitle', 'content.collections.retrieved': '$retrieved', 'content.collections.unsuccessfulCrawls': '$unsuccessfulCrawls' } },
        { $project: { 'collection': '$content.collections' } },
        { $unwind: '$collection' },
        { $replaceRoot: { newRoot: '$collection' } }
    ],
    GET_ALL_PROCESSES_PIPELINE: [
        // basically like for collections
        { $match: { path: '/processes' } },
        { $addFields: { 'content.processes.backend': '$backend', 'content.processes.backendTitle': '$backendTitle', 'content.processes.retrieved': '$retrieved', 'content.processes.unsuccessfulCrawls': '$unsuccessfulCrawls' } },
        { $project: { 'process': '$content.processes' } },
        { $unwind: '$process' },
        { $replaceRoot: {newRoot: '$process'} },
        // convert `parameters` object to array because otherwise we can't search for parameter descriptions (MongoDB doesn't support wildcards for object keys)
        { $addFields: { 'parametersAsArray' : { $objectToArray: '$parameters' } } }
    ]
};
