console.log('dataSlices.js');
const dateFormat = require('dateformat');

const checkAccess = require(__dirname + '/../checkAccess/checkAccess.js');

/**
 * @func getUserFilesSlice
 * @desc Get an access-filtered slice of the mri files from a user
 * @param {String} requestedUser Username of the user whose files are requested
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 */
const getUserFilesSlice = function getUserFilesSlice(req, requestedUser, start, length) {
    console.log('getUserFilesSlice. Start, end:', start, length);
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }

    return new Promise((resolve, reject) => {
        Promise.all([
            req.db.get('mri')
            .find({owner: requestedUser, backup: {$exists: false}}, {skip: start, limit: length}),
            req.db.get('project').find({
                $or: [
                    {owner: requestedUser},
                    {'collaborators.list': {$elemMatch: {userID: requestedUser}}}
                ],
                backup: {$exists: false}
            })
        ])
        .then(values => {
            let unfilteredMRI = values[0],
                unfilteredProjects = values[1],
                mri = [],
                mriFiles = [];

            // Filter for view access
            for (i in unfilteredMRI) {
                if (checkAccess.toFileByAllProjects(unfilteredMRI[i], unfilteredProjects, loggedUser, 'view')) {
                    mri.push(unfilteredMRI[i]);
                }
            }

            mri.map(o => {
                const obj = {
                    url: o.source,
                    name: o.name,
                    included: dateFormat(o.included, 'd mmm yyyy, HH:MM')
                };
                if (o.dim) {
                    obj.volDimensions = o.dim.join(' x ');
                    mriFiles.push(obj);
                }
            });

            if (mri.length > 0) {
                resolve({success: true, list: mriFiles});
            } else {
                resolve({success: false, list: []});
            }
        })
        .catch(err => {
            console.log('ERROR:', err);
            reject();
        });
    });
};

/**
 * @func getUserAtlasSlice
 * @desc Get an access-filtered slice of the atlas from a user
 * @param {String} requestedUser Username of the user whose files are requested
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 */
const getUserAtlasSlice = function getUserAtlasSlice(req, requestedUser, start, length) {
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }
    return new Promise((resolve, reject) => {
        Promise.all([
            req.db.get('mri')
            .find({'mri.atlas': {$elemMatch: {owner: requestedUser}}, backup: {$exists: false}}, {skip: start, limit: length}),
            req.db.get('project').find({
                $or: [
                    {owner: requestedUser},
                    {'collaborators.list': {$elemMatch: {userID: requestedUser}}}
                ],
                backup: {$exists: false}
            })
        ])
        .then(values => {
            let unfilteredAtlas = values[0],
                unfilteredProjects = values[1],
                atlas = [],
                atlasFiles = [];

            // Filter for view access
            for (i in unfilteredAtlas) {
                if (checkAccess.toFileByAllProjects(unfilteredAtlas[i], unfilteredProjects, loggedUser, 'view')) {
                    atlas.push(unfilteredAtlas[i]);
                }
            }

            atlas.map(o => {
                let i;
                for (i in o.mri.atlas) {
                    atlasFiles.push({
                        url: o.source,
                        parentName: o.name,
                        name: o.mri.atlas[i].name || '',
                        project: o.mri.atlas[i].project || '',
                        projectURL: '/project/' + o.mri.atlas[i].project || '',
                        modified: dateFormat(o.mri.atlas[i].modified, 'd mmm yyyy, HH:MM')
                    });
                }
            });

            if (atlas.length > 0) {
                resolve({success: true, list: atlasFiles});
            } else {
                resolve({success: false, list: []});
            }
        })
        .catch(err => {
            console.log('ERROR:', err);
            reject();
        });
    });
};

/**
 * @func getUserProjectsSlice
 * @desc Get a slice of the projects from a user
 * @param {String} requestedUser Username of the user whose files are requested
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 */
const getUserProjectsSlice = function getUserProjectsSlice(req, requestedUser, start, length) {
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }
    return new Promise((resolve, reject) => {
        req.db.get('project').find({
            $or: [
                {owner: requestedUser},
                {'collaborators.list': {$elemMatch: {userID: requestedUser}}}
            ],
            backup: {$exists: false}
        }, {skip: start, limit: length})
        .then(unfilteredProjects => {
            let projects = [];

            // Filter for view access
            for (i in unfilteredProjects) {
                if (checkAccess.toProject(unfilteredProjects[i], loggedUser, 'view')) {
                    projects.push(unfilteredProjects[i]);
                }
            }

            projects = projects.map(o => {
                return {
                    project: o.shortname,
                    projectName: o.name,
                    projectURL: o.brainboxURL,
                    numFiles: o.files.list.length,
                    numCollaborators: o.collaborators.list.length,
                    owner: o.owner,
                    modified: dateFormat(o.modified, 'd mmm yyyy, HH:MM')
                };
            });

            if (projects.length > 0) {
                resolve({success: true, list: projects});
            } else {
                resolve({success: false, list: []});
            }
        })
        .catch(err => {
            console.log('ERROR:', err);
            reject();
        });
    });
};

/**
 * @func getProjectFilesSlice
 * @desc Get a slice of the mri files in a project
 * @param {String} projectShortname Shortname of the project containing the files
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 * @param {boolean} namesFlag Whether to append only the name of each MRI or the complete structure
 */
const getProjectFilesSlice = function getProjectFilesSlice(req, projShortname, start, length, namesFlag) {
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }

    return new Promise((resolve, reject) => {
        start = parseInt(start);
        length = parseInt(length);
        req.db.get('project')
        .findOne({shortname: projShortname, backup: {$exists: 0}}, '-_id')
        .then(project => {
            // Check access
    if (checkAccess.toProject(project, loggedUser, 'view') === false) {
        const msg = 'User ' + loggedUser + ' is not allowed to view project ' + projShortname;
        console.log('ERROR:', msg);
        reject(msg);
        return;
    }

    if (project) {
        let list = project.files.list,
            newList = [],
            arr = [];
        let i;
        start = Math.min(start, list.length);
        length = Math.min(length, list.length - start);
        for (i = start; i < start + length; i++) {
            arr.push(req.db.get('mri').findOne({source: list[i], backup: {$exists: 0}}, {_id: 0}));
        }
        Promise.all(arr)
                .then(mris => {
    let j;
    for (j = 0; j < mris.length; j++) {
        if (mris[j]) {
                            // Check j-th mri annotation access
                            checkAccess.filterAnnotationsByProjects(mris[j], [project], loggedUser);

                            // Append to list
                            if (namesFlag) {
                                newList[j] = {source: mris[j].source, name: mris[j].name};
                            } else {
                                newList[j] = mris[j];
                            }
        } else {
            newList[j] = {
                source: list[start + j],
                name: ''
            };
        }
    }
    resolve(newList);
})
                .catch(err => {
                    console.log('ERROR:', err);
                    reject();
});
    } else {
                console.log('project is empty');
    }
})
        .catch(err => {
            console.log('ERROR:', err);
    reject();
});
    });
};

/**
 * @func getFilesSlice
 * @desc Get an access-filtered slice of all mri files
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 */
const getFilesSlice = function getFilesSlice(req, start, length) {
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }

    return new Promise((resolve, reject) => {
        Promise.all([
            req.db.get('mri')
            .find({backup: {$exists: false}}, {fields: {source: 1, _id: 0}}, {skip: start, limit: length}),
            req.db.get('project').find({backup: {$exists: false}})
        ])
        .then(values => {
            let unfilteredMRI = values[0],
                unfilteredProjects = values[1],
                mri = [],
                mriFiles = [],
                i;

            // Filter for view access
            for (i = 0; i < unfilteredMRI.length; i++) {
                if (checkAccess.toFileByAllProjects(unfilteredMRI[i], unfilteredProjects, loggedUser, 'view')) {
                    mri.push(unfilteredMRI[i]);
                }
            }

            mri.map(o => {
                mriFiles.push(o.source);
            });

            // Constrain start and length to available data
            start = Math.min(start, mriFiles.length);
            length = Math.min(length, mriFiles.length - start);
            mriFiles = mriFiles.slice(start, start + length);

            resolve(mriFiles);
        })
        .catch(err => {
            console.log('ERROR:', err);
            reject();
        });
    });
};

/**
 * @func getProjectsSlice
 * @desc Get an access-filtered slice of all projects
 * @param {integer} start Start index of the file slice
 * @param {integer} length Number of files to include in the slice
 */
const getProjectsSlice = function getProjectsSlice(req, start, length) {
    let loggedUser = 'anonymous';
    if (req.isAuthenticated()) {
        loggedUser = req.user.username;
    } else
    if (req.isTokenAuthenticated) {
        loggedUser = req.tokenUsername;
    }

    return new Promise((resolve, reject) => {
        req.db.get('project')
        .find({backup: {$exists: false}}, {skip: start, limit: length})
        .then(unfilteredProjects => {
            let projects = [];

            // Filter for view access
            for (i in unfilteredProjects) {
                if (checkAccess.toProject(unfilteredProjects[i], loggedUser, 'view')) {
                    projects.push(unfilteredProjects[i]);
                }
            }

            // Constrain start and length to available data
            start = Math.min(start, projects.length);
            length = Math.min(length, projects.length - start);

            projects = projects.slice(start, start + length);

            projects = projects.map(o => {
                return {
                    project: o.shortname,
                    projectName: o.name,
                    numFiles: o.files.list.length,
                    numCollaborators: o.collaborators.list.length,
                    owner: o.owner
                };
            });

            resolve(projects);
        })
        .catch(err => {
            console.log('ERROR:', err);
            reject();
        });
    });
};

const dataSlices = function () {
    this.getUserFilesSlice = getUserFilesSlice;
    this.getUserAtlasSlice = getUserAtlasSlice;
    this.getUserProjectsSlice = getUserProjectsSlice;
    this.getProjectFilesSlice = getProjectFilesSlice;
    this.getFilesSlice = getFilesSlice;
    this.getProjectsSlice = getProjectsSlice;
};

module.exports = new dataSlices();
