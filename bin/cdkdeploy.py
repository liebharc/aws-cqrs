#!/usr/bin/python

import os, sys
import argparse
import subprocess
import mock
import unittest
import shlex
import json
import re

scriptlocation = os.path.dirname(__file__)

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def system_no_out(command, checkReturnValue=True):
    ret = subprocess.call(shlex.split(command),stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    if checkReturnValue and ret != 0:
        eprint("Command failed: {}".format(command))
        sys.exit(1)
    return ret

def read_std_err(process):
    return process.stderr.read(1)

def capture_std_out_of_command(command):
    import subprocess
    print("# " + command)
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True,encoding="utf8")
    capture = ""

    s = read_std_err(process)
    print(s)
    while len(s) > 0:
        sys.stderr.write(s)
        sys.stderr.flush()
        capture += s
        s = read_std_err(process)

    return capture

def parse_args():
    parser = argparse.ArgumentParser(description ='Deploys the backend and creates the aws-exports.json file.\nRun tests with: python -m unittest cdkdeploy.py')
    parser.add_argument('--prod', dest ='prod',
                        action ='store_true', help ='Install prod stack, this option should only be used from CI/CD')
    parser.add_argument('--staging', dest ='staging',
                        action ='store_true', help ='Install staging stack, this option should only be used from CI/CD')
    return parser.parse_args()    

def parse_cdk_output(output):
    lines = output.split("\n")
    arrived_at_outputs_section = False
    left_outputs_section = False
    output_var = re.compile("^\w+\.(.*) = (.*)$")
    result = {}
    for line in lines:
        if line.startswith("Outputs:"):
            arrived_at_outputs_section = True
        elif line.startswith("Stack ARN:"):
            left_outputs_section = True

        if arrived_at_outputs_section and not left_outputs_section:
            match = output_var.match(line)
            if match:
                result[match.group(1)] = match.group(2)
    return result

def format_cdk_output(output):
    result = "{\n"
    result += str.join(",\n", ["  \"{}\": \"{}\"".format(key, output[key]) for key in sorted(output.keys())])
    result += "\n}"
    return result    


def main(args):
    os.chdir(os.path.join("..", "backend"))
    if args.prod:
        stdout = capture_std_out_of_command("cdk deploy prod --require-approval never")
    elif args.staging:
        stdout = capture_std_out_of_command("cdk deploy staging --require-approval never")
    else:
        stdout = capture_std_out_of_command("cdk deploy dev --require-approval never")
    parsed = parse_cdk_output(stdout)
    formatted = format_cdk_output(parsed)
    aws_exports = open(os.path.join("..", "app", "aws-exports.json"), "w")
    aws_exports.write(formatted)
    aws_exports.close()

class TestSum(unittest.TestCase):

    def test_output_parsing(self):
        stdout = """awscqrs-Dev | 10/11 | 21:24:03 | CREATE_COMPLETE      | AWS::Cognito::UserPoolGroup              | dev/admins (admins)
awscqrs-Dev | 11/11 | 21:24:05 | CREATE_COMPLETE      | AWS::CloudFormation::Stack               | awscqrs-Dev

 âœ…  dev (awscqrs-Dev)

âœ¨  Deployment time: 74.5s

Outputs:
dev.userPoolClientId = helloworld123456790123456
dev.userPoolId = eu-central-1_abcd12345
Stack ARN:

âœ¨  Total time: 80.28s"""  
        parsed = parse_cdk_output(stdout)
        self.assertEqual(parsed, {
            "userPoolClientId": "helloworld123456790123456",
            "userPoolId": "eu-central-1_abcd12345",
        })
    
    def test_output_formatting(self):
        formatted = format_cdk_output({
            "userPoolClientId": "helloworld123456790123456",
            "userPoolId": "eu-central-1_abcd12345",
        })
        self.assertEqual(formatted, """{
  "userPoolClientId": "helloworld123456790123456",
  "userPoolId": "eu-central-1_abcd12345"
}""")


if __name__=="__main__":
    args = parse_args()
    cwd = os.getcwd()
    try:
        os.chdir(scriptlocation)
        main(args)
    finally:
        os.chdir(cwd)    