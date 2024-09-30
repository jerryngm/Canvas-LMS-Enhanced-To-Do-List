(() => {

	const CSRFtoken = function() {
		return decodeURIComponent(
			(document.cookie.match("(^|;) *_csrf_token=([^;]*)") || "")[2]
		)
	};
	const requestHeaders = {
		"X-CSRF-Token": CSRFtoken(),
	};
	var dtTable;
	var enrollment_list;

	const fullTodoList = {
		queries: {
			assignments: `{
            allCourses {
              name
              _id
              submissionsConnection(filter: {states: submitted}) {
                nodes {
                  gradingStatus
                  submissionStatus
                  submittedAt
                  state
                  assignment {
                    _id
                    name
                  }
                  user {
                    _id
                    name
                    sisId
                    email
                    enrollments {
                      state
                      course {
                        _id
                      }
                    }
                  }
                }
              }
              term {
                sisTermId
                name
              }
            }
          }`,
			quizzes: `{
            allCourses {
              name
              _id
              submissionsConnection(filter: {states: pending_review}) {
                nodes {
                  gradingStatus
                  submissionStatus
                  submittedAt
                  state
                  assignment {
                    _id
                    name
                  }
                  user {
                    _id
                    name
                    sisId
                    email
                    enrollments {
                      state
                      course {
                        _id
                      }
                    }
                  }
                }
              }
              term {
                sisTermId
                name
              }
            }
          }`
		}
	};


	SkiMonitorChanges.watchForElementByQuery(
		".todo-list-header",
		addTodoButton
	);


	function addTodoButton() {

		const navigationMenu = document.querySelector(".todo-list-header");
		navigationMenu.insertAdjacentHTML("afterend",
			`<button type="button" class="Button Button--primary" id="todoshortcut"><i class="icon-not-graded" aria-hidden="true" style="vertical-align: middle;"></i> Enhanced To Do List</button>`

		);

		document.getElementById('todoshortcut').addEventListener("click", openToDo);
	}


	function openToDo() {
		CreateTodoListTable();
		const dialog = document.createElement("dialog");
		dialog.classList.add("modal-dialog");
        dialog.id = "todoModal";
		
		const wrapper = document.createElement("div");
		wrapper.classList.add("modal-dialog-content-wrapper");

		const dialogHeader = document.createElement("div");
		dialogHeader.classList.add("modal-dialog-header");

		const dialogHeading = document.createElement("h4");
		dialogHeading.innerText = "📝 Enhanced To Do List (Pending Marking)";
		dialogHeading.style.fontWeight = 'bold';

		document.body.appendChild(dialogHeading);

		const exitButton = document.createElement("button");
		exitButton.classList.add("Button");
		exitButton.classList.add("Button--small");
		exitButton.classList.add("Button--secondary");
		exitButton.innerText = "Close";
		exitButton.addEventListener("click", () => {
			closeToDoModal(dialog);
		});

		dialogHeader.append(dialogHeading);
		dialogHeader.append(exitButton);

		const dialogBody = document.createElement("div");
		dialogBody.classList.add("modal-dialog-body");

		dialogBody.innerHTML = `
    <div id="msg_todolist" class="alert alert-info" role="alert">
	
    <p><strong><i class="icon-progress" aria-hidden="true" style="vertical-align: middle;" ></i> To Do list is loading. Please wait!</strong></p>
  </div>
  <button type="button" class="Button Button--secondary" id="btn_refreshToDo" style="display: none;">
    <i class="icon-solid icon-refresh" aria-hidden="true" style="vertical-align: middle;"></i> Refresh Pending Marking List
  </button>
  <table id="todolist" class="table table-bordered hover order-column compact" style="width:100%" cellspacing="0">
    <thead></thead>
  </table>
`;
       

		wrapper.append(dialogHeader);
		wrapper.append(dialogBody);
		dialog.append(wrapper);

		const content = document.getElementById("content");
		content.append(dialog);
		document.querySelector('#btn_refreshToDo').addEventListener("click", refreshToDoList);
		dialog.showModal();
		
		
				const observer = new ResizeObserver(() => {
			if ($.fn.DataTable.isDataTable('#todolist')) {
				$('#todolist').DataTable().columns.adjust().responsive.recalc();
			}
		});
		observer.observe(dialog);
		
	}

	function closeToDoModal(dialog) {
		dtTable.destroy();
        dtTable = null;

		const todolistTable = document.querySelector('#todolist');
		if (todolistTable) {
			while (todolistTable.firstChild) {
				todolistTable.removeChild(todolistTable.firstChild);
			}
		}

		// Remove #msg_todolist
		const msgTodoList = document.querySelector('#msg_todolist');
		if (msgTodoList) {
			msgTodoList.remove();
		}

		// Remove #btn_refreshToDo
		const btnRefreshToDo = document.querySelector('#btn_refreshToDo');
		if (btnRefreshToDo) {
			btnRefreshToDo.remove();
		}

		// Remove the entire #todolist element
		if (todolistTable) {
			todolistTable.remove();
		}
		dialog.close();
	}


	function refreshToDoList() {
dtTable.destroy();
dtTable = null;

var rows = document.querySelectorAll('#todolist tr');

// Loop through the rows and remove each one
rows.forEach(function(row) {
    row.parentNode.removeChild(row);
});
			CreateTodoListTable();
			document.getElementById("msg_todolist").style.display = 'block';
			document.querySelector('#btn_refreshToDo').style.display = 'none';
	}

function GetTodoList(query) {
    var tdlist_filtered;

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fetch('/api/graphql', {
                method: 'POST',
                headers: {
                    ...requestHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: 'query ' + query
                })
            })
            .then(response => response.json())
            .then(result => {
                tdlist_filtered = result.data.allCourses.filter(d => d.submissionsConnection.nodes.length !== 0);
                resolve(CreateTodoListArray(tdlist_filtered));
            })
            .catch(error => {
                console.log(error);
                reject(error);
            });
        }, 500);
    });
}


function GetEnrollment() {
    return new Promise((resolve, reject) => {
        enrollment_list = []; // Initialize the enrollment list to store all pages of enrollment data

        function fetchEnrollments(url) {
            fetch(url, {
                method: 'GET',
                headers: requestHeaders
            })
            .then(response => {
                // Extract the pagination link from the headers
                const linkHeader = response.headers.get('Link');
                return response.json().then(result => ({ result, linkHeader }));
            })
            .then(({ result, linkHeader }) => {
                // Add current page's results to the enrollment list
                enrollment_list = enrollment_list.concat(result);

                const nextLink = getNextLinkFromHeader(linkHeader);
                if (nextLink) {
                    fetchEnrollments(nextLink); // Fetch the next page if it exists
                } else {
                    resolve(enrollment_list); // Resolve once all pages have been fetched
                }
            })
            .catch(error => {
                console.log(error);
                reject(error); // Reject if an error occurs
            });
        }

        // Start fetching from the initial URL
        fetchEnrollments('/api/v1/users/self/enrollments');
    });

    // Helper function to extract the "next" link from the pagination header
    function getNextLinkFromHeader(linkHeader) {
        if (!linkHeader) return null;

        const links = linkHeader.split(',');
        for (let i = 0; i < links.length; i++) {
            const parts = links[i].split(';');
            const url = parts[0].replace(/[<>]/g, '').trim();
            const rel = parts[1].trim();

            if (rel === 'rel="next"') {
                return url; // Return the next page's URL
            }
        }
        return null;
    }
}




	function CreateTodoListArray(data) {

		//console.log(data)
		//console.log(enrollment_list)
		//var requests = 0;
		var todolist = [];
		var classlist = 0;
		var submissionlist = 0;
		var enrolmentlist = 0;
		var canvas_url = window.location.origin;
		for (classlist = 0; classlist < data.length; classlist++) {
			//console.log('length of classlist', data.length)
			//console.log('current class', classlist)
			submissionlist = 0;
			for (submissionlist = 0; submissionlist < data[classlist].submissionsConnection.nodes.length; submissionlist++) {
				//console.log('length of node', data[classlist].submissionsConnection.nodes.length)
				//console.log('current submission', submissionlist)
				for (enrolmentlist = 0; enrolmentlist < data[classlist].submissionsConnection.nodes[submissionlist].user.enrollments.length; enrolmentlist++) {
					if (data[classlist].submissionsConnection.nodes[submissionlist].user.enrollments[enrolmentlist].course._id == data[classlist]._id && data[classlist].submissionsConnection.nodes[submissionlist].user.enrollments[enrolmentlist].state == 'active' && data[classlist].submissionsConnection.nodes[submissionlist].user.name !== 'Test Student' && /Demo\b/.test(data[classlist].name) == false) {


						var matching_enrolment = enrollment_list.find(e =>
							e.course_id == data[classlist]._id
						);

						// Add the role and enrollment_state from the matching enrolment data
						var role = matching_enrolment ? matching_enrolment.type : null;
						var enrollment_state = matching_enrolment ? matching_enrolment.enrollment_state : null;


						todolist.push({
							coursename: data[classlist].name,
							stdname: data[classlist].submissionsConnection.nodes[submissionlist].user.name,
							sisid: data[classlist].submissionsConnection.nodes[submissionlist].user.sisId,
							stdemail: data[classlist].submissionsConnection.nodes[submissionlist].user.email,
							assname: data[classlist].submissionsConnection.nodes[submissionlist].assignment.name,
							submittedat: data[classlist].submissionsConnection.nodes[submissionlist].submittedAt,
							daysince: moment().diff(data[classlist].submissionsConnection.nodes[submissionlist].submittedAt, 'days'),
							speedgrader: canvas_url + '/courses/' + data[classlist]._id + '/gradebook/speed_grader?assignment_id=' + data[classlist].submissionsConnection.nodes[submissionlist].assignment._id + '&student_id=' + data[classlist].submissionsConnection.nodes[submissionlist].user._id,
							term: data[classlist].term.name,
							role: role,
							enrollment_state: enrollment_state
						})
					}
				}
			}
		}
		return todolist;
	}


	async function CreateTodoListTable() {
		// Try running these asynchronous functions
		const enrollment = await GetEnrollment(); // Await for enrollment data to be fetched
		const [quiz, assignment] = await Promise.all([
			GetTodoList(fullTodoList.queries.quizzes),
			GetTodoList(fullTodoList.queries.assignments)
		]);

		//console.log(enrollment); // You can now access the enrollment data here
		// Continue with the rest of the code

		//console.log(quiz);
		//console.log(assignment);
		var combinedArray = quiz.concat(assignment);
		var table;

		if (document.getElementById("msg_todolist")) {
			document.getElementById("msg_todolist").style.display = 'none';
		}
		document.querySelector('#btn_refreshToDo').style.display = 'block';

		/* 		setHeader();

				function setHeader() {
					var $tr = $('<tr>');
					$tr.append($('<th>').text("Course Name"));
					$tr.append($('<th>').text("Term"));
					$tr.append($('<th>').text("Student Name"));
					$tr.append($('<th>').text("Student ID"));
					$tr.append($('<th>').text("Student Email"));
					$tr.append($('<th>').text("Assignment Name"));
					$tr.append($('<th>').text("Submitted At"));
					$tr.append($('<th>').text("Day Since Submitted"));
					$tr.append($('<th>').text("SpeedGrader Link"));
					$tr.append($('<th>').text("Role"));
					$tr.append($('<th>').text("Enrolment State"));
					$tr.appendTo('#todolist thead');
				} */
		setHeader();

		function setHeader() {
			const tr = document.createElement('tr');

			// Create an array of header titles
			const headers = [
				"Course Name",
				"Term",
				"Student Name",
				"Student ID (SIS ID)",
				"Student Email",
				"Assignment Name",
				"Submitted At",
				"Day Since Submitted",
				"SpeedGrader Link",
				"Role",
				"Enrolment State"
			];

			// Loop through each header and append <th> to <tr>
			headers.forEach(text => {
				const th = document.createElement('th');
				th.textContent = text;
				tr.appendChild(th);
			});
			document.querySelector('#todolist thead').appendChild(tr);
		}
		
		
		
		dtTable = new DataTable('#todolist', {
			data: combinedArray,
			"lengthMenu": [10, 25, 50, { label: 'All', value: -1 }],
			"ordering": true,
			"order": [
				[7, "desc"]
			],
			"processing": true,
			colReorder: true,
			responsive: true,
			stateSave: true,
			layout: {
			top2: "searchPanes",
			top: "searchBuilder",
            topStart: "buttons",
                    },
			//Change column visibility here
			"columns": [{
					data: "coursename",
					visible: true
				},
				{
					data: "term",
					visible: true
				},
				{
					data: "stdname",
					visible: true
				},
				{
					data: "sisid",
					visible: true
				},
				{
					data: "stdemail",
					visible: false
				},
				{
					data: "assname",
					visible: true
				},
				{
					data: "submittedat",
					visible: true
				},
				{
					data: "daysince",
					visible: true
				},
				{
					data: "speedgrader",
					visible: true,
					className: 'speedgrader-link'
				},
				{
					data: "role",
					visible: true
				},
				{
					data: "enrollment_state",
					visible: true
				}
			],
			keys: true,
			searchPanes: {
			cascadePanes: true,
			columns: [0, 1, 9, 10]
			},
			"columnDefs": [{
					targets: [6],
					data: "submittedat",
					render: function(data, _type, _row, _meta) {
						moment.updateLocale(moment.locale(), {
							invalidDate: ""
						});
						return moment(data).format('YYYY/MM/DD HH:mm');
					}
				},
				{
					targets: 8,
					render: function(data, _type, _row, _meta) {
						return `<a href="${data}" target="_blank">Go to <i class="icon-line icon-speed-grader" aria-hidden="true"></i></a>`;
					}
				}
			],
			buttons: [{
					extend: 'excelHtml5',
					filename: 'Canvas_Ungraded_Report_' + moment().format('YYYY-MM-DD'),
					title: '',
					autoFilter: true,
					exportOptions: {
						columns: ':visible',
						format: {
							body: function(data, row, column, node) {
								if ($(node).hasClass('speedgrader-link')) {
									// Return only the URL
									return $(node).find('a').attr('href') || data;
								}
								return data;
							}
						}
					}
				},
				{
					extend: 'copyHtml5',
					title: '',
					exportOptions: {
						columns: ':visible',
						format: {
							body: function(data, row, column, node) {
								if ($(node).hasClass('speedgrader-link')) {
									// Return only the URL
									return $(node).find('a').attr('href') || data;
								}
								return data;
							}
						}
					}
				},
				{
					extend: 'print',
					title: 'Ungraded Submission as of ' + moment().format('YYYY-MM-DD'),
					exportOptions: {
						columns: ':visible',
						format: {
							body: function(data, row, column, node) {
								if ($(node).hasClass('speedgrader-link')) {
									// Return only the URL
									return $(node).find('a').attr('href') || data;
								}
								return data;
							}
						}
					}
				},
				{
					extend: 'colvis'
				}
			],
			searchBuilder: {
				columns: [0, 1, 2, 3, 5, 6, 7, 9, 10],
				preDefined: {
					criteria: [{
						condition: '=',
						data: 'Role',
						value: ['TeacherEnrollment']
					}, {
						condition: '=',
						data: 'Role',
						value: ['TaEnrollment']
					}, ],
					logic: 'OR'
				}

			}
			
		});

		
	};
	


})();